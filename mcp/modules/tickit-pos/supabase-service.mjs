import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readBoolean } from '../../core/config.mjs'
import { uuid, entities, columnsFor, listSchema, entityDataSchema, tenantConfigureSchema } from './admin-schema.mjs'
import { catalogCommands } from './catalog.mjs'
import { TickitUsers } from './users.mjs'

export class TickitError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details }
}
export function tickitError(error) {
  if (error instanceof TickitError) return { code: error.code, message: error.message, ...error.details }
  return { code: 'TICKIT_POS_ERROR', message: 'No se pudo completar la operación de Tickit POS.' }
}
export function readTickitConfig(env = process.env) {
  const environment = env.TICKIT_POS_ENVIRONMENT || 'staging'
  if (environment !== 'staging') throw new Error('Tickit POS está habilitado únicamente para staging.')
  let url
  try { url = new URL(env.TICKIT_POS_SUPABASE_URL) } catch { throw new Error('Configura TICKIT_POS_SUPABASE_URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('TICKIT_POS_SUPABASE_URL debe ser el origen de Supabase, sin rutas.')
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Supabase remoto requiere HTTPS.')
  const serviceRoleKey = env.TICKIT_POS_SERVICE_ROLE_KEY || ''
  let role
  try { role = JSON.parse(Buffer.from(serviceRoleKey.split('.')[1], 'base64url').toString()).role } catch {}
  if (!serviceRoleKey.startsWith('sb_secret_') && role !== 'service_role') throw new Error('Configura TICKIT_POS_SERVICE_ROLE_KEY con una clave service_role o sb_secret_ de staging.')
  // Service authority is platform-wide. Legacy tenant/venue pins are intentionally ignored.
  return { url: url.origin, serviceRoleKey, access: 'platform_superadmin', environment,
    readOnly: readBoolean(env.TICKIT_POS_READ_ONLY, false, 'TICKIT_POS_READ_ONLY') }
}

const forbidden = /^(password|encrypted_password|access_token|refresh_token|service_role_key|api_key|token|token_key|secret|confirmation_token|recovery_token)$/i
export class TickitPosService {
  constructor(config, { fetchImpl = fetch } = {}) {
    this.config = config
    this.db = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: 'public', retry: false },
      global: { fetch: async (url, options = {}) => {
        const response = await fetchImpl(url, { ...options, redirect: 'error', signal: options.signal || AbortSignal.timeout(15000) })
        if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) { await response.body?.cancel(); throw new Error('Response too large') }
        // Bound responses before the SDK parses them; neither SDK errors nor tool output receive raw secrets.
        if (!response.body) return response
        const reader = response.body.getReader()
        const chunks = []
        let bytes = 0
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            bytes += value.byteLength
            if (bytes > 4 * 1024 * 1024) { await reader.cancel(); throw new Error('Response too large') }
            chunks.push(value)
          }
        } finally { reader.releaseLock() }
        return new Response([204, 205, 304].includes(response.status) ? null : Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers })
      } },
    })
    this.users = new TickitUsers(this)
  }
  sanitize(value) {
    if (typeof value === 'string') return value.replaceAll(this.config.serviceRoleKey, '[REDACTED]')
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.test(key)).map(([key, item]) => [key, this.sanitize(item)]))
    return value
  }
  assertWrite(confirm) {
    if (this.config.readOnly) throw new TickitError('READ_ONLY', 'Tickit POS está en modo solo lectura.')
    if (confirm !== true) throw new TickitError('CONFIRM_REQUIRED', 'La operación requiere confirm=true.')
  }
  async result(request, write = false) {
    let result
    try { result = await request } catch { throw new TickitError('SUPABASE_UNAVAILABLE', 'No se recibió respuesta de Supabase.', write ? { outcome_unknown: true, recovery: 'Comprueba el estado y los IDs antes de repetir; no se realizan reintentos automáticos.' } : undefined) }
    if (result.error) {
      const status = result.status ?? result.error.status
      const unknown = write && (!status || status >= 500)
      throw new TickitError(`SUPABASE_${String(result.error.code || result.status || 'ERROR').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80)}`,
        status === 401 || status === 403 ? 'Supabase rechazó la credencial o los permisos.' : 'Supabase rechazó la operación. Comprueba los datos, las relaciones y las migraciones del POS.',
        unknown ? { outcome_unknown: true, recovery: 'Comprueba el estado y los IDs antes de repetir; no se realizan reintentos automáticos.' } : undefined)
    }
    return result
  }
  forTenant(tenantId) {
    // Per-call data-integrity context, never a permission boundary or shared mutable selection.
    return Object.assign(Object.create(Object.getPrototypeOf(this)), { config: { ...this.config, tenantId: uuid.parse(tenantId) }, db: this.db, users: this.users })
  }
  async tenant(tenantId = this.config.tenantId) {
    if (!uuid.safeParse(tenantId).success) throw new TickitError('TENANT_REQUIRED', 'Indica tenant_id de destino.')
    const { data } = await this.result(this.db.from('tenants').select('id,name,slug,is_active').eq('id', tenantId).maybeSingle())
    if (!data) throw new TickitError('TENANT_UNAVAILABLE', 'La empresa de destino no existe.')
    return data
  }
  async venue(venueId) {
    if (!uuid.safeParse(venueId).success) throw new TickitError('VENUE_REQUIRED', 'Indica venue_id del local de destino.')
    let query = this.db.from('venues').select('id,tenant_id,name,is_active').eq('id', venueId)
    if (this.config.tenantId) query = query.eq('tenant_id', this.config.tenantId)
    const { data } = await this.result(query.maybeSingle())
    if (!data) throw new TickitError('VENUE_UNAVAILABLE', 'El local no existe o no pertenece a la empresa indicada.')
    return data
  }
  scoped(table, query, venueId) {
    if (entities[table].scope !== 'platform' && this.config.tenantId) query = query.eq('tenant_id', this.config.tenantId)
    if (entities[table].scope === 'venue' && venueId) query = query.eq('venue_id', venueId)
    return query
  }
  async owned(table, id, venueId) {
    const { data } = await this.result(this.scoped(table, this.db.from(table).select(columnsFor(table).join(',')).eq('id', uuid.parse(id)), venueId).maybeSingle())
    if (!data) throw new TickitError('NOT_FOUND', 'Registro no encontrado para los identificadores indicados.')
    return data
  }
  async capabilities() {
    await this.result(this.db.from('tenants').select('id').limit(1))
    await this.result(this.db.auth.admin.listUsers({ page: 1, perPage: 1 }))
    return { connected: true, backend: 'supabase', access: 'platform_superadmin', scope: 'platform', environment: this.config.environment, read_only: this.config.readOnly,
      entities: Object.fromEntries(Object.entries(entities).map(([key, def]) => [key, { operations: def.operations.filter((op) => !this.config.readOnly || ['list', 'get'].includes(op)), fields: columnsFor(key) }])),
      catalog_commands: this.config.readOnly ? [] : Object.keys(catalogCommands), limits: { page_size: 100, response_bytes: 4194304 },
    }
  }
  async execute(table, operation, input) {
    const def = entities[table]
    if (!def?.operations.includes(operation)) throw new TickitError('OPERATION_UNAVAILABLE', 'Operación no disponible.')
    const write = !['list', 'get'].includes(operation)
    if (write) this.assertWrite(input.confirm)
    if (!this.config.tenantId && def.scope !== 'platform') {
      if (operation === 'list') {
        listSchema(table).parse(input)
        const venue = input.venue_id ? await this.venue(input.venue_id) : null
        if (venue && input.tenant_id && venue.tenant_id !== input.tenant_id) throw new TickitError('TARGET_MISMATCH', 'El local no pertenece al tenant_id indicado.')
        const target = input.tenant_id || venue?.tenant_id
        if (target) { await this.tenant(target); return this.forTenant(target).execute(table, operation, input) }
      } else {
        const record = operation === 'create' ? null : await this.owned(table, input.id)
        const venue = def.scope === 'venue' ? await this.venue(input.venue_id || record?.venue_id) : null
        const target = input.tenant_id || venue?.tenant_id || record?.tenant_id
        if ((record && target !== record.tenant_id) || (venue && target !== venue.tenant_id) || (record && venue && record.venue_id !== venue.id)) throw new TickitError('TARGET_MISMATCH', 'Los identificadores no corresponden a la misma empresa/local.')
        await this.tenant(target)
        return this.forTenant(target).execute(table, operation, { ...input, ...(venue ? { venue_id: venue.id } : {}) })
      }
    }
    if (this.config.tenantId) await this.tenant()
    const venue = def.scope === 'venue' && (operation !== 'list' || input.venue_id) ? await this.venue(input.venue_id) : null
    const venueId = venue?.id
    if (operation === 'list') {
      const args = listSchema(table).parse(input)
      let query = this.scoped(table, this.db.from(table).select(columnsFor(table).join(',')), venueId)
      for (const filter of args.filters) query = filter.operator === 'contains' ? query.ilike(filter.field, `%${String(filter.value).replace(/[\\%_]/g, (c) => `\\${c}`)}%`) : query[filter.operator](filter.field, filter.value)
      const defaultFields = columnsFor(table).includes('id') ? ['id'] : columnsFor(table).filter((field) => !['tenant_id', 'venue_id'].includes(field)).slice(0, 2)
      for (const sort of args.sort.length ? args.sort : defaultFields.map((field) => ({ field, direction: 'asc' }))) query = query.order(sort.field, { ascending: sort.direction === 'asc' })
      const start = (args.page - 1) * args.per_page
      const { data } = await this.result(query.range(start, start + args.per_page))
      return { items: this.sanitize((data || []).slice(0, args.per_page)), page: args.page, per_page: args.per_page, has_more: (data || []).length > args.per_page }
    }
    if (operation === 'get') return this.sanitize(await this.owned(table, input.id, venueId))
    const existing = operation !== 'create' ? await this.owned(table, input.id, venueId) : null
    if (operation === 'delete') {
      if (table === 'tenants') {
        const [cash, orders] = await Promise.all(['cash_sessions', 'orders'].map((target) => this.result(this.db.from(target).select('id').eq('tenant_id', input.id).eq('status', 'open').limit(1))))
        if (cash.data?.length || orders.data?.length) throw new TickitError('OPEN_WORK', 'Cierra las cajas y comandas de la empresa antes de eliminarla.')
      }
      if (table === 'dining_areas') {
        const { data: tables } = await this.result(this.db.from('restaurant_tables').select('id').eq('tenant_id', this.config.tenantId).eq('venue_id', venueId).eq('area_id', input.id).limit(1))
        if (tables?.length) throw new TickitError('AREA_IN_USE', 'Reasigna las mesas antes de eliminar esta zona.')
      }
      const { data } = await this.result(this.scoped(table, this.db.from(table).delete().eq('id', input.id), venueId).select('id').maybeSingle(), true)
      if (!data) throw new TickitError('NOT_FOUND', 'No se ha eliminado ningún registro.')
      return { deleted: true, id: input.id, ...(table === 'tenants' ? { auth_accounts_deleted: false } : {}) }
    }
    let values = entityDataSchema(table, operation).parse(input.data)
    if (operation === 'update' && ['devices', 'cash_registers', 'venues'].includes(table)) await this.guardOpenWork(table, existing, values)
    for (const [key, relation] of Object.entries(def.relations)) if (values[key]) await this.owned(relation, values[key], venueId)
    if (table === 'venues' && operation === 'create') {
      values.catalog_profile = 'custom'
    }
    if (table === 'inventory_units' && operation === 'create') {
      values.id = randomUUID()
      values.content_unit_id ??= values.id
      values.content_quantity ??= 1
    }
    if (table === 'devices') values = await this.deviceValues({ ...existing, ...values }, values, venueId)
    if (table === 'production_destinations' && values.is_active !== false && !(values.kds_enabled ?? existing?.kds_enabled) && !(values.printer_id ?? existing?.printer_id)) throw new TickitError('DESTINATION_OUTPUT', 'Un destino activo necesita KDS o impresora.')
    let query
    if (operation === 'create') query = this.db.from(table).insert({ ...values, ...(def.scope !== 'platform' ? { tenant_id: this.config.tenantId } : {}), ...(venueId ? { venue_id: venueId } : {}) })
    else query = this.scoped(table, this.db.from(table).update(values).eq('id', input.id), venueId)
    const { data } = await this.result(query.select(columnsFor(table).join(',')).single(), true)
    return this.sanitize(data)
  }
  async guardOpenWork(table, existing, values) {
    const deviceFields = ['device_mode', 'is_active', 'default_cash_register_id', 'production_destination_id', 'can_take_orders', 'can_take_payments', 'can_open_cash_session', 'can_close_cash_session', 'can_manage_cash']
    if (table !== 'devices' && values.is_active !== false) return
    if (table === 'devices' && !deviceFields.some((field) => Object.hasOwn(values, field) && values[field] !== existing[field])) return
    let sessions = this.db.from('cash_sessions').select('id').eq('tenant_id', this.config.tenantId).eq('status', 'open')
    let orders = this.db.from('orders').select('id').eq('tenant_id', this.config.tenantId).eq('status', 'open')
    const field = table === 'devices' ? 'opened_by_device_id' : table === 'cash_registers' ? 'cash_register_id' : 'venue_id'
    const [cash, pending] = await Promise.all([this.result(sessions.eq(field, existing.id).limit(1)), this.result(orders.eq(field, existing.id).limit(1))])
    if (cash.data?.length || pending.data?.length) throw new TickitError('OPEN_WORK', 'Cierra las cajas y comandas vinculadas antes de cambiar estas capacidades o desactivar el registro.')
  }
  async deviceValues(merged, values, venueId) {
    if (['satellite', 'kds'].includes(merged.device_mode)) {
      Object.assign(values, { can_take_payments: false, can_open_cash_session: false, can_close_cash_session: false, can_manage_cash: false })
      if (merged.device_mode === 'kds') values.can_take_orders = false
    }
    if (merged.device_mode === 'kds') {
      if (!merged.production_destination_id) throw new TickitError('KDS_DESTINATION', 'Selecciona un destino de producción para el KDS.')
      const destination = await this.owned('production_destinations', merged.production_destination_id, venueId)
      const { data: feature } = await this.result(this.db.from('tenant_feature_assignments').select('feature_key').eq('tenant_id', this.config.tenantId).eq('feature_key', 'production').maybeSingle())
      const { data: venue } = await this.result(this.db.from('venues').select('production_enabled').eq('tenant_id', this.config.tenantId).eq('id', venueId).single())
      if (!feature || !venue.production_enabled || !destination.kds_enabled || !destination.is_active) throw new TickitError('KDS_UNAVAILABLE', 'Producción/KDS no está habilitado para este local y destino.')
    }
    return values
  }
  async catalog(venueId, mode = 'admin') {
    if (!this.config.tenantId) { const venue = await this.venue(venueId); return this.forTenant(venue.tenant_id).catalog(venueId, mode) }
    await this.tenant()
    const venue = await this.venue(venueId)
    const { data } = await this.result(this.db.rpc('get_catalog', { p_venue_id: venue.id, p_mode: mode }))
    if (data?.tenant_id !== this.config.tenantId || data?.venue_id !== venue.id) throw new TickitError('CATALOG_SCOPE', 'El catálogo no corresponde a la empresa y local configurados.')
    return this.sanitize(data)
  }
  async catalogCommand(commandName, input) {
    this.assertWrite(input.confirm)
    if (!catalogCommands[commandName]) throw new TickitError('OPERATION_UNAVAILABLE', 'Comando de catálogo no disponible.')
    if (!this.config.tenantId) {
      const venue = await this.venue(input.venue_id)
      return this.forTenant(venue.tenant_id).catalogCommand(commandName, input)
    }
    const def = catalogCommands[commandName]
    if (!def) throw new TickitError('OPERATION_UNAVAILABLE', 'Comando de catálogo no disponible.')
    const payload = def.schema.parse(input.data)
    await this.tenant()
    const venue = await this.venue(input.venue_id)
    for (const [key, table] of Object.entries(def.refs)) if (payload[key]) await this.owned(table, payload[key], venue.id)
    if (commandName.startsWith('assignments_')) {
      const family = payload.domain === 'selection' ? 'selection' : 'modifier'
      if (payload.id) await this.owned(`product_${family}_group_assignments`, payload.id, venue.id)
      if (payload.productId) await this.owned('products', payload.productId, venue.id)
      if (payload.groupId) await this.owned(`${family}_groups`, payload.groupId, venue.id)
      if (payload.minSelection > payload.maxSelection) throw new TickitError('SELECTION_LIMITS', 'El mínimo de selección supera el máximo.')
      for (const id of payload.variantIds || []) {
        const variant = await this.owned('product_variants', id, venue.id)
        if (variant.product_id !== payload.productId) throw new TickitError('VARIANT_SCOPE', 'La variante no pertenece al producto.')
      }
    }
    if (payload.items) {
      const table = commandName === 'sale_formats_reorder' ? 'catalog_sale_formats' : ({ variants: 'product_variants', placements: 'catalog_placements', tabs: 'catalog_tabs', tab_categories: 'catalog_tab_categories', selection_options: 'selection_group_options', selection_assignments: 'product_selection_group_assignments', modifier_assignments: 'product_modifier_group_assignments' })[payload.entity] || payload.entity
      for (const item of payload.items) await this.owned(table, item.id, venue.id)
    }
    if (payload.storagePath && (!payload.storagePath.startsWith(`${this.config.tenantId}/${venue.id}/products/`) || payload.storagePath.split('/').some((p) => p === '..' || p === '.'))) throw new TickitError('IMAGE_PATH', 'La imagen debe estar dentro del almacenamiento del local.')
    if (commandName.endsWith('_create')) payload.id ??= randomUUID()
    if (commandName === 'products_create') for (const variant of payload.variants) variant.id ??= randomUUID()
    let rpc = def.rpc
    let args = { p_venue_id: venue.id, ...(def.command ? { p_command: def.command } : { p_action: def.action }), p_payload: payload }
    if (commandName === 'products_create' && payload.variants.some((variant) => variant.formatId)) {
      if (payload.variants.some((variant) => !variant.formatId)) throw new TickitError('FORMAT_REQUIRED', 'Selecciona un formato para cada variante del producto.')
      payload.id ??= randomUUID()
      for (const variant of payload.variants) { variant.id ??= randomUUID(); await this.owned('catalog_sale_formats', variant.formatId, venue.id) }
      rpc = 'catalog_command_batch_with_formats'
      args = { p_venue_id: venue.id, p_commands: [{ command: def.command, payload }], p_variant_formats: payload.variants.map((variant) => ({ variantId: variant.id, formatId: variant.formatId })), p_new_formats: [] }
    } else if (commandName.startsWith('variants_') && payload.formatId) rpc = 'catalog_variant_format_command'
    let data
    try { ({ data } = await this.result(this.db.rpc(rpc, args), true)) }
    catch (error) {
      if (error instanceof TickitError && error.details?.outcome_unknown) error.details = { ...error.details, requested_id: payload.id || null, variant_ids: payload.variants?.map((variant) => variant.id) || [] }
      throw error
    }
    // Orphaned storage cleanup is separate from committed SQL. Return it explicitly for follow-up.
    return { result: this.sanitize(data), committed: true, ...(payload.id ? { id: payload.id } : {}), storage_cleanup: 'Los paths huérfanos devueltos no se eliminan automáticamente.' }
  }
  async configureTenant(input) {
    input = tenantConfigureSchema.parse(input)
    this.assertWrite(input.confirm)
    await this.tenant(input.tenant_id)
    const { data } = await this.result(this.db.rpc('update_platform_tenant_config', {
      p_tenant_id: input.tenant_id, p_name: input.name, p_slug: input.slug, p_max_venues: input.max_venues, p_max_devices: input.max_devices,
      p_feature_keys: [...new Set(input.feature_keys), '__addon_catalog_v2', '__assist_catalog_v1'],
    }).maybeSingle(), true)
    if (!data) throw new TickitError('TENANT_UNAVAILABLE', 'La empresa de destino no existe.')
    return this.sanitize(data)
  }
}
