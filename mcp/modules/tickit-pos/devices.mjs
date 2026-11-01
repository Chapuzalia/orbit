import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { uuid, confirmInput } from './admin-schema.mjs'
import { DEFAULT_USER_PASSWORD } from './users.mjs'
import { TickitError } from './supabase-service.mjs'

export const deviceCredentialsSchema = z.object({ device_id: uuid, password: z.string().min(8).max(72).optional(), ...confirmInput }).strict()
export const deviceAccessContract = {
  automatic_on_create: true, repair_tool: 'tickit_pos_devices_credentials_create', role: 'cashier',
  existing_access: 'Se conserva sin restablecer contraseña ni sustituir cuentas. Las vinculaciones inconsistentes requieren revisión.',
  partial_failure: 'El dispositivo se conserva. Consulta device_id/user_id antes de repetir; las escrituras inciertas no se reintentan.',
}
const accountResult = (device, user, active, created) => ({ device_id: device.id, tenant_id: device.tenant_id, venue_id: device.venue_id,
  credentials_created: created, account: { user_id: user.id, email: user.email, role: 'cashier', is_active: active } })

export async function provisionDeviceCredentials(service, input) {
  input = deviceCredentialsSchema.parse(input)
  service.assertWrite(input.confirm)
  const device = await service.owned('devices', input.device_id)
  const scoped = service.forTenant(device.tenant_id)
  const [tenant, venue] = await Promise.all([scoped.tenant(), scoped.venue(device.venue_id)])
  const { data: assignments } = await service.result(service.db.from('device_user_assignments').select('user_id,tenant_id,venue_id,is_active')
    .eq('tenant_id', device.tenant_id).eq('device_id', device.id).limit(2))
  if (assignments?.length) {
    if (assignments.length !== 1 || assignments[0].venue_id !== device.venue_id) throw new TickitError('DEVICE_ACCESS_REVIEW', 'El dispositivo tiene vinculaciones inconsistentes o múltiples. Revisa sus accesos sin crear otra cuenta.', { device_id: device.id })
    const user = await service.users.get(assignments[0].user_id)
    const membership = user.memberships.find((entry) => entry.tenant_id === device.tenant_id)
    if (!membership || membership.role !== 'cashier' || user.is_superadmin) throw new TickitError('DEVICE_ACCESS_REVIEW', 'La cuenta vinculada no es una credencial de cajero válida. Revisa su membresía sin sustituirla.', { device_id: device.id, user_id: user.id })
    if (!user.email_confirmed_at || Date.parse(user.banned_until || '') > Date.now()) throw new TickitError('DEVICE_ACCESS_REVIEW', 'La cuenta vinculada sigue sin confirmar o bloqueada en Auth. Comprueba el alta parcial por su ID antes de habilitarla; no se restablece automáticamente.', { device_id: device.id, user_id: user.id })
    return accountResult(device, user, Boolean(tenant.is_active && venue.is_active && device.is_active && membership.is_active && assignments[0].is_active), false)
  }
  if (!tenant.is_active || !venue.is_active) throw new TickitError('DEVICE_PARENT_INACTIVE', 'Activa explícitamente la empresa y el local antes de crear credenciales; no se cambian sus estados automáticamente.', { device_id: device.id, write_attempted: false })
  await scoped.guardOpenWork('devices', device, { is_active: !device.is_active })
  await scoped.deviceValues(device, {}, device.venue_id)
  // Stable across renames and concurrent repairs; Auth email uniqueness prevents duplicate accounts.
  const email = `dispositivo-${device.id.replaceAll('-', '')}@pos.tickit.invalid`
  const password = input.password ?? DEFAULT_USER_PASSWORD
  const userId = randomUUID()
  const active = device.is_active !== false
  const details = { device_id: device.id, user_id: userId, email }
  let stage = 'auth'
  let created = false
  try {
    const { data } = await service.result(service.db.auth.admin.createUser({ id: userId, email, password, email_confirm: false,
      ban_duration: '876000h', user_metadata: { full_name: device.name } }), true)
    if (data.user?.id !== userId) throw new TickitError('DEVICE_AUTH_CREATE_UNKNOWN', 'Auth no confirmó el ID solicitado. Comprueba la cuenta antes de repetir.', { outcome_unknown: true })
    created = true
    stage = 'profile'
    await service.result(service.db.from('profiles').upsert({ id: userId, full_name: device.name, is_superadmin: false }), true)
    stage = 'membership'
    await service.result(service.db.from('tenant_memberships').insert({ tenant_id: device.tenant_id, user_id: userId, role: 'cashier', is_active: active }), true)
    stage = 'assignment'
    await service.result(service.db.from('device_user_assignments').insert({ tenant_id: device.tenant_id, venue_id: device.venue_id, device_id: device.id, user_id: userId, is_active: active }), true)
    stage = 'enable_auth'
    await service.result(service.db.auth.admin.updateUserById(userId, { email_confirm: true, ban_duration: 'none' }), true)
    return accountResult(device, { id: userId, email }, active, true)
  } catch (error) {
    if (error instanceof TickitError && error.details?.outcome_unknown) throw new TickitError('DEVICE_ACCESS_SETUP_UNKNOWN', 'No se pudo confirmar el alta del acceso. Comprueba el dispositivo y la cuenta por sus IDs antes de repetir.', { ...details, failed_stage: stage, outcome_unknown: true })
    let cleanup = !created
    if (created) {
      try { await service.result(service.db.auth.admin.deleteUser(userId), true); cleanup = true } catch {}
    }
    throw new TickitError('DEVICE_ACCESS_SETUP_PARTIAL', 'No se completaron las credenciales. El dispositivo se conserva; revisa los IDs y la compensación antes de usar devices_credentials_create.',
      { ...details, failed_stage: stage, auth_cleanup_complete: cleanup, cause_code: error instanceof TickitError ? error.code : 'DEVICE_ACCESS_ERROR' })
  }
}
