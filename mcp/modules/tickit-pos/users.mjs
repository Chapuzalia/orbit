import { uuid, userCreateSchema, userUpdateSchema, accessGrantSchema } from './admin-schema.mjs'
import { TickitError } from './supabase-service.mjs'

export class TickitUsers {
  constructor(service) { this.s = service }
  async profile(userId) {
    const { data } = await this.s.result(this.s.db.from('profiles').select('id,full_name,is_superadmin').eq('id', userId).maybeSingle())
    return data
  }
  async auth(userId) {
    const { data } = await this.s.result(this.s.db.auth.admin.getUserById(uuid.parse(userId)))
    if (!data.user) throw new TickitError('USER_NOT_FOUND', 'La cuenta Auth no existe.')
    return data.user
  }
  summary(user, profile) {
    return { id: user.id, email: user.email, full_name: profile?.full_name || '', is_superadmin: profile?.is_superadmin === true,
      email_confirmed_at: user.email_confirmed_at || null, banned_until: user.banned_until || null }
  }
  async get(userId) {
    uuid.parse(userId)
    const [auth, profile, memberships, scopes, devices] = await Promise.all([
      this.auth(userId), this.profile(userId),
      this.s.result(this.s.db.from('tenant_memberships').select('id,user_id,tenant_id,role,is_active').eq('user_id', userId)),
      this.s.result(this.s.db.from('manager_venue_assignments').select('tenant_id,venue_id').eq('manager_user_id', userId)),
      this.s.result(this.s.db.from('device_user_assignments').select('tenant_id,device_id,venue_id,is_active').eq('user_id', userId)),
    ])
    return { ...this.summary(auth, profile), memberships: memberships.data || [], manager_venue_assignments: scopes.data || [], device_assignments: devices.data || [] }
  }
  async list({ page = 1, per_page = 50, tenant_id } = {}) {
    let accounts, hasMore
    if (tenant_id) {
      await this.s.tenant(tenant_id)
      const start = (page - 1) * per_page
      const { data } = await this.s.result(this.s.db.from('tenant_memberships').select('user_id').eq('tenant_id', tenant_id).order('user_id').range(start, start + per_page))
      accounts = await Promise.all((data || []).slice(0, per_page).map((row) => this.auth(row.user_id)))
      hasMore = (data || []).length > per_page
    } else {
      const { data } = await this.s.result(this.s.db.auth.admin.listUsers({ page, perPage: per_page }))
      accounts = data.users || []
      // Some Auth/proxy versions omit pagination headers; a full page then means a possible next page.
      hasMore = data.total > 0 ? page * per_page < data.total : (data.nextPage > page || accounts.length === per_page)
    }
    const items = await Promise.all(accounts.map(async (user) => this.summary(user, await this.profile(user.id))))
    return { items, page, per_page, has_more: hasMore }
  }
  async noOpenWork(userId, tenantId) {
    let cash = this.s.db.from('cash_sessions').select('id').eq('opened_by', userId).eq('status', 'open')
    let orders = this.s.db.from('orders').select('id').eq('opened_by_user_id', userId).eq('status', 'open')
    if (tenantId) { cash = cash.eq('tenant_id', tenantId); orders = orders.eq('tenant_id', tenantId) }
    const [sessions, pending] = await Promise.all([this.s.result(cash.limit(1)), this.s.result(orders.limit(1))])
    if (sessions.data?.length || pending.data?.length) throw new TickitError('OPEN_WORK', 'Cierra las cajas y comandas del usuario antes de cambiar su acceso.')
  }
  async validateAccess(input) {
    const scoped = this.s.forTenant(input.tenant_id)
    await scoped.tenant()
    if (input.role === 'manager') {
      for (const id of new Set(input.venue_ids)) {
        const venue = await scoped.venue(id)
        if (!venue.is_active) throw new TickitError('VENUE_INACTIVE', 'Activa el local antes de asignarlo al manager.')
      }
    }
    if (input.role === 'cashier') {
      const device = await scoped.owned('devices', input.device_id)
      if (!device.is_active) throw new TickitError('DEVICE_UNAVAILABLE', 'El dispositivo está desactivado.')
      const venue = await scoped.venue(device.venue_id)
      if (!venue.is_active) throw new TickitError('VENUE_INACTIVE', 'Activa el local antes de asignar el dispositivo.')
      const { data: occupied } = await this.s.result(this.s.db.from('device_user_assignments').select('user_id').eq('tenant_id', input.tenant_id).eq('device_id', device.id).eq('is_active', true).limit(1))
      // active_cash_session_id is not part of the public device projection; check actual sessions too.
      const { data: sessions } = await this.s.result(this.s.db.from('cash_sessions').select('id').eq('tenant_id', input.tenant_id).eq('opened_by_device_id', device.id).eq('status', 'open').limit(1))
      if (occupied?.some((row) => row.user_id !== input.user_id) || sessions?.length) throw new TickitError('DEVICE_OCCUPIED', 'El dispositivo tiene otro acceso activo o una caja abierta.')
      return device
    }
    return null
  }
  async grant(input) {
    input = accessGrantSchema.parse(input)
    this.s.assertWrite(input.confirm)
    await this.auth(input.user_id)
    const device = await this.validateAccess(input)
    await this.noOpenWork(input.user_id, input.tenant_id)
    const { data: previous } = await this.s.result(this.s.db.from('tenant_memberships').select('id,tenant_id,user_id,role,is_active').eq('tenant_id', input.tenant_id).eq('user_id', input.user_id).maybeSingle())
    const membershipId = previous?.id || crypto.randomUUID()
    let stage = 'membership'
    try {
      await this.s.result(this.s.db.from('tenant_memberships').upsert({ id: membershipId, tenant_id: input.tenant_id, user_id: input.user_id, role: input.role, is_active: true }, { onConflict: 'tenant_id,user_id' }), true)
      stage = 'assignments'
      await this.s.result(this.s.db.from('device_user_assignments').update({ is_active: false }).eq('tenant_id', input.tenant_id).eq('user_id', input.user_id), true)
      if (input.role === 'manager') {
        await this.s.result(this.s.db.rpc('set_manager_venue_assignments', { p_tenant_id: input.tenant_id, p_manager_user_id: input.user_id, p_venue_ids: [...new Set(input.venue_ids)] }), true)
      } else {
        await this.s.result(this.s.db.from('manager_venue_assignments').delete().eq('tenant_id', input.tenant_id).eq('manager_user_id', input.user_id), true)
      }
      if (device) await this.s.result(this.s.db.from('device_user_assignments').upsert({ tenant_id: input.tenant_id, user_id: input.user_id, venue_id: device.venue_id, device_id: device.id, is_active: true }, { onConflict: 'tenant_id,user_id' }), true)
    } catch {
      // Restore the previous membership, never silently disable an existing owner on failure.
      let restored = false, disabled = false
      try {
        if (previous) { await this.s.result(this.s.db.from('tenant_memberships').upsert(previous, { onConflict: 'tenant_id,user_id' }), true); restored = true }
        else { await this.s.result(this.s.db.from('tenant_memberships').update({ is_active: false }).eq('tenant_id', input.tenant_id).eq('user_id', input.user_id), true); disabled = true }
      } catch {}
      throw new TickitError('ACCESS_SETUP_PARTIAL', 'No se completó el acceso. Revisa membresía y asignaciones antes de reintentar.', { user_id: input.user_id, tenant_id: input.tenant_id, membership_id: membershipId, failed_stage: stage, previous_membership_restored: restored, access_disabled: disabled, assignments_may_have_changed: stage === 'assignments' })
    }
    return { granted: true, user_id: input.user_id, tenant_id: input.tenant_id, membership_id: membershipId, role: input.role }
  }
  async create(input) {
    input = userCreateSchema.parse(input)
    this.s.assertWrite(input.confirm)
    if (input.tenant_id) await this.validateAccess(input)
    const { data } = await this.s.result(this.s.db.auth.admin.createUser({ email: input.email.trim().toLowerCase(), password: input.password,
      email_confirm: false, ban_duration: '876000h', user_metadata: { full_name: input.full_name || '' } }), true)
    const userId = data.user?.id
    if (!userId) throw new TickitError('AUTH_CREATE_UNKNOWN', 'Auth no devolvió el ID de la cuenta. Comprueba el alta antes de repetir.', { outcome_unknown: true })
    try {
      await this.s.result(this.s.db.from('profiles').upsert({ id: userId, full_name: input.full_name || null, is_superadmin: input.role === 'superadmin' }), true)
      if (input.tenant_id) await this.grant({ user_id: userId, tenant_id: input.tenant_id, role: input.role, venue_ids: input.venue_ids, device_id: input.device_id, confirm: true })
      await this.s.result(this.s.db.auth.admin.updateUserById(userId, { email_confirm: input.email_confirm, ban_duration: 'none' }), true)
    } catch {
      const removed = await this.s.db.auth.admin.deleteUser(userId)
      throw new TickitError('USER_SETUP_PARTIAL', 'El alta no se completó. Comprueba la compensación antes de repetir.', { user_id: userId, auth_cleanup_complete: !removed.error, account_initially_banned: true })
    }
    return this.get(userId)
  }
  async update(input) {
    input = userUpdateSchema.parse(input)
    this.s.assertWrite(input.confirm)
    await this.auth(input.user_id)
    const authValues = Object.fromEntries(['email', 'password', 'email_confirm', 'ban_duration'].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]))
    const profileValues = Object.fromEntries(['full_name', 'is_superadmin'].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]))
    if (!Object.keys(authValues).length && !Object.keys(profileValues).length) throw new TickitError('EMPTY_UPDATE', 'Indica los campos que deseas actualizar.')
    if (Object.keys(authValues).length) await this.s.result(this.s.db.auth.admin.updateUserById(input.user_id, authValues), true)
    if (Object.keys(profileValues).length) {
      try { await this.s.result(this.s.db.from('profiles').upsert({ id: input.user_id, ...profileValues }, { onConflict: 'id' }), true) }
      catch { throw new TickitError('USER_UPDATE_PARTIAL', 'No se completó el perfil; los cambios anteriores de Auth pueden haberse guardado.', { user_id: input.user_id, auth_updated: Object.keys(authValues).length > 0 }) }
    }
    return this.get(input.user_id)
  }
  async revoke(userId, tenantId, confirm) {
    this.s.assertWrite(confirm)
    uuid.parse(userId)
    await this.s.tenant(tenantId)
    await this.noOpenWork(userId, tenantId)
    const { data } = await this.s.result(this.s.db.from('tenant_memberships').update({ is_active: false }).eq('tenant_id', tenantId).eq('user_id', userId).select('id').maybeSingle(), true)
    if (!data) throw new TickitError('MEMBERSHIP_NOT_FOUND', 'El usuario no tiene acceso a esa empresa.')
    try { await this.s.result(this.s.db.from('device_user_assignments').update({ is_active: false }).eq('tenant_id', tenantId).eq('user_id', userId), true) }
    catch { throw new TickitError('ACCESS_REVOKE_PARTIAL', 'Membresía revocada; comprueba los accesos de terminal.', { user_id: userId, tenant_id: tenantId, membership_disabled: true }) }
    return { revoked: true, user_id: userId, tenant_id: tenantId, auth_account_deleted: false, other_memberships_unchanged: true,
      note: 'El perfil superadmin conserva acceso global hasta desactivarlo con users_update. Los JWT emitidos pueden seguir vigentes hasta caducar.' }
  }
  async delete(userId, confirm) {
    this.s.assertWrite(confirm)
    await this.auth(userId)
    await this.noOpenWork(userId)
    const completed = []
    try {
      await this.s.result(this.s.db.auth.admin.updateUserById(userId, { ban_duration: '876000h' }), true); completed.push('auth_banned')
      await this.s.result(this.s.db.from('profiles').update({ is_superadmin: false }).eq('id', userId), true); completed.push('superadmin_disabled')
      await this.s.result(this.s.db.from('tenant_memberships').update({ is_active: false }).eq('user_id', userId), true); completed.push('memberships_disabled')
      await this.s.result(this.s.db.from('device_user_assignments').update({ is_active: false }).eq('user_id', userId), true); completed.push('devices_disabled')
      await this.s.result(this.s.db.auth.admin.deleteUser(userId), true)
    } catch { throw new TickitError('USER_DELETE_PARTIAL', 'No se confirmó el borrado global de Auth. Revisa los pasos aplicados antes de repetir.', { user_id: userId, completed_steps: completed }) }
    return { deleted: true, user_id: userId, scope: 'platform', note: 'Los JWT emitidos pueden seguir vigentes hasta caducar; no se garantiza revocación instantánea en sistemas externos.' }
  }
}
