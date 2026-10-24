import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { TickitPosService, readTickitConfig, tickitError } from '../mcp/modules/tickit-pos/service.mjs'
import { userCreateSchema, entityDataSchema } from '../mcp/modules/tickit-pos/schema.mjs'
import { catalogCommands } from '../mcp/modules/tickit-pos/catalog.mjs'
import { createSupabaseFixture, tickitEnv, serviceRoleKey, ids } from './helpers/tickit-supabase.mjs'

const setup = (overrides = {}) => {
  const fixture = createSupabaseFixture()
  return { ...fixture, service: new TickitPosService(readTickitConfig({ ...tickitEnv, ...overrides }), fixture) }
}
const product = () => ({ venue_id: ids.venue, confirm: true, data: { type: 'standard', name: 'Coffee', variants: [{ name: 'Unidad', priceCents: 150, formatId: ids.format }] } })
const newUser = (role = 'manager') => ({ email: `${role}@example.com`, password: 'Test-only-password-123', full_name: 'Test user', role,
  ...(['owner', 'manager', 'cashier'].includes(role) ? { tenant_id: ids.tenant } : {}),
  venue_ids: role === 'manager' ? [ids.venue] : [], ...(role === 'cashier' ? { device_id: ids.device } : {}), confirm: true })

test('service_role lists across the platform; tenant and venue are optional target filters', async () => {
  const { service, state, rows } = setup({ TICKIT_POS_TENANT_ID: ids.tenant, TICKIT_POS_VENUE_ID: ids.venue })
  rows('products').push({ id: randomUUID(), tenant_id: ids.otherTenant, venue_id: ids.otherVenue, name: 'Other product' })
  assert.equal((await service.capabilities()).access, 'platform_superadmin')
  assert.equal((await service.execute('products', 'list', {})).items.length, 2)
  const request = state.requests.find((r) => r.path === '/rest/v1/products')
  assert.equal(request.params.get('tenant_id'), null)
  assert.equal(request.params.get('venue_id'), null)
  assert.equal(request.headers.get('apikey'), serviceRoleKey)
  assert.equal(request.headers.get('authorization'), `Bearer ${serviceRoleKey}`)
  assert.equal((await service.execute('products', 'list', { tenant_id: ids.otherTenant })).items[0].name, 'Other product')
  assert.equal((await service.execute('products', 'list', { venue_id: ids.otherVenue })).items[0].name, 'Other product')
  await assert.rejects(service.execute('products', 'list', { tenant_id: ids.tenant, venue_id: ids.otherVenue }), (e) => e.code === 'TARGET_MISMATCH')
  await service.execute('inventory_stock_levels', 'list', {})
  assert.equal(state.requests.find((r) => r.path.endsWith('/inventory_stock_levels')).params.get('order'), 'warehouse_id.asc,inventory_item_id.asc')
  await assert.rejects(service.execute('products', 'get', { id: randomUUID() }), /no encontrado/)
})

test('concurrent writes to different companies do not share mutable tenant context', async () => {
  const { service } = setup()
  const [first, second] = await Promise.all([
    service.execute('cash_registers', 'create', { venue_id: ids.venue, confirm: true, data: { name: 'One' } }),
    service.execute('cash_registers', 'create', { venue_id: ids.otherVenue, confirm: true, data: { name: 'Two' } }),
  ])
  assert.equal(first.tenant_id, ids.tenant)
  assert.equal(second.tenant_id, ids.otherTenant)
  assert.equal(service.config.tenantId, undefined)
  const updated = await service.execute('cash_registers', 'update', { id: second.id, data: { name: 'Two updated' }, confirm: true })
  assert.equal(updated.tenant_id, ids.otherTenant)
  assert.equal(updated.name, 'Two updated')
})

test('global authority preserves local data integrity and rejects system fields', async () => {
  const { service, rows } = setup()
  const area = { id: randomUUID(), tenant_id: ids.otherTenant, venue_id: ids.otherVenue, name: 'Other area' }
  rows('dining_areas').push(area)
  await assert.rejects(service.execute('restaurant_tables', 'create', { venue_id: ids.venue, confirm: true, data: { name: 'Table', area_id: area.id } }), /no encontrado/)
  const table = await service.execute('restaurant_tables', 'create', { venue_id: ids.otherVenue, confirm: true, data: { name: 'Table', area_id: area.id } })
  assert.equal(table.tenant_id, ids.otherTenant)
  await assert.rejects(service.execute('restaurant_tables', 'update', { id: table.id, venue_id: ids.venue, confirm: true, data: { name: 'Moved' } }), (e) => e.code === 'TARGET_MISMATCH')
  await assert.rejects(service.execute('cash_registers', 'create', { confirm: true, data: { name: 'Ambiguous' } }), /venue_id/)
  await assert.rejects(service.execute('venues', 'create', { confirm: true, data: { name: 'Ambiguous' } }), /tenant_id/)
  assert.ok(!entityDataSchema('devices', 'update').safeParse({ tenant_id: ids.otherTenant }).success)
})

test('companies can be created, configured, deactivated and administered while inactive', async () => {
  const { service, state, rows } = setup()
  const tenant = await service.execute('tenants', 'create', { data: { name: 'New company', slug: 'new-company', max_venues: 3, max_devices: 5 }, confirm: true })
  const venue = await service.execute('venues', 'create', { tenant_id: tenant.id, data: { name: 'New local' }, confirm: true })
  assert.equal(venue.tenant_id, tenant.id)
  const configured = await service.configureTenant({ tenant_id: tenant.id, name: 'Updated', slug: 'updated', max_venues: 4, max_devices: 10, feature_keys: ['production'], confirm: true })
  assert.equal(configured.max_devices, 10)
  const rpc = state.requests.find((r) => r.path.endsWith('/update_platform_tenant_config'))
  assert.deepEqual(rpc.body.p_feature_keys, ['production', '__addon_catalog_v2', '__assist_catalog_v1'])
  assert.ok(!entityDataSchema('tenants', 'update').safeParse({ max_devices: 999 }).success)
  await service.execute('tenants', 'update', { id: tenant.id, data: { is_active: false }, confirm: true })
  assert.equal((await service.execute('venues', 'list', { tenant_id: tenant.id })).items.length, 1)
  rows('cash_sessions').push({ id: randomUUID(), tenant_id: tenant.id, status: 'open' })
  await assert.rejects(service.execute('tenants', 'delete', { id: tenant.id, confirm: true }), /Cierra las cajas/)
  rows('cash_sessions').length = 0
  assert.equal((await service.execute('tenants', 'delete', { id: tenant.id, confirm: true })).auth_accounts_deleted, false)
})

test('catalog uses transactional RPC and links every created variant to its sale format', async () => {
  const { service, state, rows } = setup()
  const result = await service.catalogCommand('products_create', product())
  assert.equal(result.committed, true)
  const call = state.requests.find((r) => r.path.endsWith('/catalog_command_batch_with_formats'))
  assert.equal(call.body.p_venue_id, ids.venue)
  assert.equal(call.body.p_commands[0].command, 'create_product')
  assert.equal(call.body.p_commands[0].payload.variants[0].priceCents, 150)
  assert.equal(call.body.p_variant_formats[0].formatId, ids.format)
  assert.ok(call.body.p_variant_formats[0].variantId)
  assert.ok(!state.requests.some((r) => r.method === 'POST' && r.path === '/rest/v1/products'))
  assert.equal((await service.catalog(ids.venue)).tenant_id, ids.tenant)
  await service.catalogCommand('products_update', { venue_id: ids.venue, confirm: true, data: { id: result.id, name: 'Updated' } })
  assert.equal(rows('products').find((r) => r.id === result.id).name, 'Updated')
})

test('catalog administers any venue but refuses mismatched references and fractional cents', async () => {
  const { service, rows, state } = setup()
  const other = { id: randomUUID(), tenant_id: ids.otherTenant, venue_id: ids.otherVenue, name: 'Other' }
  rows('products').push(other)
  await assert.rejects(service.catalogCommand('products_update', { venue_id: ids.venue, confirm: true, data: { id: other.id, name: 'Wrong venue' } }), /no encontrado/)
  await service.catalogCommand('products_update', { venue_id: ids.otherVenue, confirm: true, data: { id: other.id, name: 'Updated other' } })
  assert.equal(other.name, 'Updated other')
  const before = state.requests.length
  await assert.rejects(service.catalogCommand('run_sql', { confirm: true, data: {} }), /no disponible/)
  assert.equal(state.requests.length, before)
  const bad = product(); bad.data.variants[0].priceCents = 1.5
  assert.ok(!catalogCommands.products_create.schema.safeParse(bad.data).success)
})

test('users_create provisions manager Auth and assignments before allowing login', async () => {
  const { service, state, rows } = setup()
  const result = await service.users.create(newUser())
  assert.equal(result.memberships[0].role, 'manager')
  assert.deepEqual(result.manager_venue_assignments, [{ tenant_id: ids.tenant, venue_id: ids.venue }])
  assert.equal(rows('profiles')[0].is_superadmin, false)
  assert.equal(state.users.get(result.id).banned_until, null)
  const creation = state.requests.find((r) => r.method === 'POST' && r.path === '/auth/v1/admin/users')
  assert.equal(creation.body.email_confirm, false)
  assert.equal(creation.body.ban_duration, '876000h')
  assert.ok(state.requests.findIndex((r) => r.method === 'PUT') > state.requests.findIndex((r) => r.path.endsWith('/set_manager_venue_assignments')))
  assert.ok(!JSON.stringify(result).includes(newUser().password))
})

test('global Auth includes unattached accounts and real platform superadmins', async () => {
  const { service, rows } = setup()
  const root = await service.users.create(newUser('superadmin'))
  const user = await service.users.create(newUser('user'))
  assert.equal(root.is_superadmin, true)
  assert.deepEqual(root.memberships, [])
  assert.equal((await service.users.list({ per_page: 1 })).has_more, true)
  assert.equal((await service.users.list({ page: 2, per_page: 1 })).items[0].id, user.id)
  assert.equal((await service.users.list({ tenant_id: ids.tenant })).items.length, 0)
  const changed = await service.users.update({ user_id: root.id, is_superadmin: false, full_name: 'Changed', confirm: true })
  assert.equal(changed.is_superadmin, false)
  assert.equal(changed.full_name, 'Changed')
  assert.equal(rows('profiles').find((p) => p.id === root.id).is_superadmin, false)
  assert.ok(userCreateSchema.safeParse(newUser('superadmin')).success)
})

test('shared users can change role and receive access in several companies', async () => {
  const { service, state, rows } = setup()
  const user = await service.users.create(newUser('user'))
  await service.users.grant({ user_id: user.id, tenant_id: ids.tenant, role: 'owner', confirm: true })
  await service.users.grant({ user_id: user.id, tenant_id: ids.otherTenant, role: 'manager', venue_ids: [ids.otherVenue], confirm: true })
  assert.equal((await service.users.get(user.id)).memberships.length, 2)
  await service.users.update({ user_id: user.id, email: 'shared@example.com', password: 'Another-password-123', is_superadmin: true, confirm: true })
  assert.equal(state.users.get(user.id).email, 'shared@example.com')
  await service.users.grant({ user_id: user.id, tenant_id: ids.tenant, role: 'manager', venue_ids: [ids.venue], confirm: true })
  assert.equal(rows('tenant_memberships').find((r) => r.tenant_id === ids.tenant).role, 'manager')
  await service.users.grant({ user_id: user.id, tenant_id: ids.tenant, role: 'cashier', device_id: ids.device, confirm: true })
  assert.equal(rows('manager_venue_assignments').filter((r) => r.tenant_id === ids.tenant).length, 0)
  assert.equal(rows('device_user_assignments')[0].is_active, true)
  await service.users.revoke(user.id, ids.tenant, true)
  const result = await service.users.get(user.id)
  assert.equal(result.memberships.find((r) => r.tenant_id === ids.tenant).is_active, false)
  assert.equal(result.memberships.find((r) => r.tenant_id === ids.otherTenant).is_active, true)
  assert.equal(result.is_superadmin, true)
})

test('owners can be revoked and inactive managers reactivated without entering Tickit', async () => {
  const { service } = setup()
  const owner = await service.users.create(newUser('owner'))
  await service.users.revoke(owner.id, ids.tenant, true)
  await service.users.grant({ user_id: owner.id, tenant_id: ids.tenant, role: 'manager', venue_ids: [ids.venue], confirm: true })
  const result = await service.users.get(owner.id)
  assert.equal(result.memberships[0].is_active, true)
  assert.equal(result.memberships[0].role, 'manager')
})

test('cashiers require a free device and cannot use another company venue', async () => {
  const { service } = setup()
  const result = await service.users.create(newUser('cashier'))
  assert.equal(result.device_assignments[0].device_id, ids.device)
  await assert.rejects(service.users.create({ ...newUser('cashier'), email: 'second@example.com' }), (e) => e.code === 'DEVICE_OCCUPIED')
  await assert.rejects(service.users.grant({ user_id: result.id, tenant_id: ids.otherTenant, role: 'manager', venue_ids: [ids.venue], confirm: true }), /no pertenece/)
})

test('global delete blocks open work anywhere, then disables every access and superadmin', async () => {
  const { service, rows, state } = setup()
  const user = await service.users.create(newUser('superadmin'))
  await service.users.grant({ user_id: user.id, tenant_id: ids.tenant, role: 'owner', confirm: true })
  await service.users.grant({ user_id: user.id, tenant_id: ids.otherTenant, role: 'owner', confirm: true })
  rows('cash_sessions').push({ id: randomUUID(), tenant_id: ids.otherTenant, opened_by: user.id, status: 'open' })
  await assert.rejects(service.users.delete(user.id, true), /Cierra las cajas/)
  assert.equal(state.users.get(user.id).banned_until, null)
  rows('cash_sessions').length = 0
  state.fail = (r) => r.method === 'DELETE' && r.path.startsWith('/auth/v1/admin/users/')
  await assert.rejects(service.users.delete(user.id, true), (e) => e.code === 'USER_DELETE_PARTIAL' && e.details.completed_steps.includes('superadmin_disabled'))
  assert.ok(rows('tenant_memberships').every((r) => r.is_active === false))
  assert.equal(rows('profiles')[0].is_superadmin, false)
  state.fail = null
  assert.equal((await service.users.delete(user.id, true)).deleted, true)
  assert.equal(state.users.has(user.id), false)
})

test('failed creation compensates only its new account; failed grant preserves previous owner membership', async () => {
  const { service, state, rows } = setup()
  state.fail = (r) => r.path.endsWith('/set_manager_venue_assignments')
  await assert.rejects(service.users.create(newUser()), (e) => e.code === 'USER_SETUP_PARTIAL' && e.details.auth_cleanup_complete === true)
  assert.equal(state.users.size, 0)
  state.fail = null
  const owner = await service.users.create(newUser('owner'))
  state.fail = (r) => r.path.endsWith('/set_manager_venue_assignments')
  await assert.rejects(service.users.grant({ user_id: owner.id, tenant_id: ids.tenant, role: 'manager', venue_ids: [ids.venue], confirm: true }), (e) => e.details.previous_membership_restored === true)
  assert.equal(rows('tenant_memberships')[0].role, 'owner')
  assert.equal(rows('tenant_memberships')[0].is_active, true)
})

test('device and user access changes retain open cash/order guards', async () => {
  const { service, rows } = setup()
  const owner = await service.users.create(newUser('owner'))
  rows('orders').push({ id: randomUUID(), tenant_id: ids.tenant, opened_by_user_id: owner.id, status: 'open' })
  await assert.rejects(service.users.revoke(owner.id, ids.tenant, true), /Cierra las cajas/)
  rows('cash_sessions').push({ id: randomUUID(), tenant_id: ids.tenant, opened_by_device_id: ids.device, status: 'open' })
  await assert.rejects(service.execute('devices', 'update', { id: ids.device, confirm: true, data: { device_mode: 'satellite' } }), /Cierra las cajas/)
})

test('lost RPC responses report uncertain writes without retrying', async () => {
  const { service, state, rows } = setup()
  state.dropAfter = (r) => r.path.endsWith('/catalog_command_batch_with_formats')
  await assert.rejects(service.catalogCommand('products_create', product()), (e) => Boolean(tickitError(e).outcome_unknown && tickitError(e).requested_id))
  assert.equal(rows('products').filter((r) => r.name === 'Coffee').length, 1)
  assert.equal(state.requests.filter((r) => r.path.endsWith('/catalog_command_batch_with_formats')).length, 1)
})

test('read-only and confirmations block even platform superadmin operations', async () => {
  const { service, state } = setup({ TICKIT_POS_READ_ONLY: 'true' })
  await assert.rejects(service.users.create(newUser('superadmin')), /solo lectura/)
  await assert.rejects(service.execute('tenants', 'delete', { id: ids.tenant, confirm: true }), /solo lectura/)
  assert.equal(state.requests.length, 0)
  service.config.readOnly = false
  await assert.rejects(service.execute('tenants', 'delete', { id: ids.tenant, confirm: false }), /confirm/)
})

test('secrets are sanitized and economic writes remain explicit workflows', async () => {
  const { service, state } = setup()
  assert.ok(!JSON.stringify(service.sanitize({ service_role_key: serviceRoleKey, password: 'private', value: `Bearer ${serviceRoleKey}` })).includes(serviceRoleKey))
  assert.ok(!JSON.stringify(service.sanitize({ password: 'private' })).includes('private'))
  state.fail = () => true
  await assert.rejects(service.capabilities(), (e) => !JSON.stringify(tickitError(e)).includes(serviceRoleKey))
  await assert.rejects(service.execute('sales', 'update', { confirm: true, id: randomUUID(), data: { total_cents: 1 } }), /no disponible/)
})
