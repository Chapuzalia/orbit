import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createAlteilServer } from '../mcp/core/server.mjs'
import { createTickitPosModule } from '../mcp/modules/tickit-pos/index.mjs'
import { TickitPosService, readTickitConfig, tickitError } from '../mcp/modules/tickit-pos/service.mjs'
import { provisionDeviceCredentials } from '../mcp/modules/tickit-pos/devices.mjs'
import { createSupabaseFixture, tickitEnv, ids } from './helpers/tickit-supabase.mjs'

const setup = (config = {}) => {
  const fixture = createSupabaseFixture()
  return { ...fixture, service: new TickitPosService(readTickitConfig({ ...tickitEnv, ...config }), fixture) }
}
const repair = { device_id: ids.device, confirm: true }
const create = (device_mode = 'checkout') => ({ venue_id: ids.venue, data: { name: 'Barra', device_mode }, confirm: true })
const writes = (state) => state.requests.filter((request) => request.method !== 'GET')

test('creating each device mode provisions Auth, cashier membership and matching terminal access', async () => {
  for (const mode of ['checkout', 'satellite', 'hybrid', 'kds']) {
    const { service, state, rows } = setup()
    const input = create(mode)
    if (mode === 'kds') {
      const destination = { id: randomUUID(), tenant_id: ids.tenant, venue_id: ids.venue, kds_enabled: true, is_active: true }
      rows('production_destinations').push(destination)
      rows('tenant_feature_assignments').push({ tenant_id: ids.tenant, feature_key: 'production' })
      rows('venues')[0].production_enabled = true
      input.data.production_destination_id = destination.id
    }
    const device = await service.execute('devices', 'create', input)
    assert.equal(device.access.credentials_created, true)
    assert.equal(device.access.account.is_active, true)
    assert.equal(device.access.account.role, 'cashier')
    const userId = device.access.account.user_id
    assert.equal(state.users.get(userId).banned_until, null)
    assert.ok(state.users.get(userId).email_confirmed_at)
    assert.deepEqual(rows('device_user_assignments')[0], { id: rows('device_user_assignments')[0].id, tenant_id: ids.tenant, venue_id: ids.venue, device_id: device.id, user_id: userId, is_active: true })
    assert.equal(rows('tenant_memberships')[0].role, 'cashier')
    assert.equal(rows('profiles')[0].is_superadmin, false)
    const authCreate = state.requests.find((request) => request.path === '/auth/v1/admin/users' && request.method === 'POST')
    assert.equal(authCreate.body.password, 'ay654Dfg')
    assert.equal(authCreate.body.ban_duration, '876000h')
    assert.ok(state.requests.findIndex((request) => request.method === 'PUT') > state.requests.findIndex((request) => request.path.endsWith('/device_user_assignments') && request.method === 'POST'))
    assert.ok(!JSON.stringify(device).includes(authCreate.body.password))
    assert.equal(device.can_take_payments, ['checkout', 'hybrid'].includes(mode))
  }
})

test('repair attaches credentials to the same device and never reactivates an inactive device', async () => {
  for (const active of [true, false]) {
    const { service, state, rows } = setup()
    rows('devices')[0].is_active = active
    const result = await provisionDeviceCredentials(service, { ...repair, password: 'Explicit-password-123' })
    assert.equal(result.device_id, ids.device)
    assert.equal(result.account.is_active, active)
    assert.equal(rows('devices').length, 1)
    assert.equal(rows('devices')[0].is_active, active)
    assert.equal(rows('device_user_assignments')[0].is_active, active)
    assert.equal(rows('tenant_memberships')[0].is_active, active)
    assert.equal(state.requests.find((request) => request.path === '/auth/v1/admin/users' && request.method === 'POST').body.password, 'Explicit-password-123')
    assert.ok(!writes(state).some((request) => request.path === '/rest/v1/devices'))
  }
})

test('existing credentials are preserved across repeated repairs and device renames', async () => {
  const { service, state, rows } = setup()
  const original = await provisionDeviceCredentials(service, repair)
  rows('devices')[0].name = 'Renamed'
  const before = writes(state).length
  const repeated = await provisionDeviceCredentials(service, { ...repair, password: 'Must-not-reset-123' })
  assert.equal(repeated.credentials_created, false)
  assert.deepEqual(repeated.account, original.account)
  assert.equal(writes(state).length, before)
  assert.equal(state.users.size, 1)
})

test('read-only, confirmation, scope and open work prevent provisioning writes', async () => {
  const readOnly = setup({ TICKIT_POS_READ_ONLY: 'true' })
  await assert.rejects(provisionDeviceCredentials(readOnly.service, repair), (error) => error.code === 'READ_ONLY')
  assert.equal(readOnly.state.requests.length, 0)
  const { service, state, rows } = setup()
  await assert.rejects(provisionDeviceCredentials(service, { ...repair, confirm: false }))
  assert.equal(state.requests.length, 0)
  await assert.rejects(provisionDeviceCredentials(service.forTenant(ids.otherTenant), repair), (error) => error.code === 'NOT_FOUND')
  rows('cash_sessions').push({ id: randomUUID(), tenant_id: ids.tenant, opened_by_device_id: ids.device, status: 'open' })
  await assert.rejects(provisionDeviceCredentials(service, repair), (error) => error.code === 'OPEN_WORK')
  assert.equal(writes(state).length, 0)
})

test('inactive parents and inconsistent existing assignments require review without writes', async () => {
  for (const table of ['tenants', 'venues']) {
    const { service, state, rows } = setup()
    rows(table)[0].is_active = false
    await assert.rejects(provisionDeviceCredentials(service, repair), (error) => error.code === 'DEVICE_PARENT_INACTIVE')
    assert.equal(writes(state).length, 0)
  }
  const { service, state, rows } = setup()
  await provisionDeviceCredentials(service, repair)
  rows('tenant_memberships')[0].role = 'owner'
  const before = writes(state).length
  await assert.rejects(provisionDeviceCredentials(service, repair), (error) => error.code === 'DEVICE_ACCESS_REVIEW')
  assert.equal(writes(state).length, before)
})

test('definite setup failure cleans only its new account and retains the device for repair', async () => {
  const fixture = createSupabaseFixture()
  const unrelated = randomUUID()
  fixture.state.users.set(unrelated, { id: unrelated, email: 'existing@example.com' })
  let fail = true
  const service = new TickitPosService(readTickitConfig(tickitEnv), { fetchImpl: async (url, options) => {
    if (fail && new URL(url).pathname.endsWith('/tenant_memberships') && options.method === 'POST') return new Response(JSON.stringify({ code: '23514', message: 'private backend error' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    return fixture.fetchImpl(url, options)
  } })
  await assert.rejects(provisionDeviceCredentials(service, repair), (error) => {
    assert.equal(error.code, 'DEVICE_ACCESS_SETUP_PARTIAL')
    assert.equal(error.details.device_id, ids.device)
    assert.equal(error.details.auth_cleanup_complete, true)
    assert.ok(!JSON.stringify(tickitError(error)).includes('private'))
    return true
  })
  assert.deepEqual([...fixture.state.users.keys()], [unrelated])
  assert.equal(fixture.rows('devices').length, 1)
  fail = false
  assert.equal((await provisionDeviceCredentials(service, repair)).credentials_created, true)
})

test('uncertain Auth or assignment writes return known IDs without retry or cleanup', async () => {
  for (const stage of ['auth', 'assignment', 'enable_auth']) {
    const { service, state, rows } = setup()
    state.dropAfter = (request) => stage === 'auth' ? request.path === '/auth/v1/admin/users' && request.method === 'POST'
      : stage === 'enable_auth' ? request.path.startsWith('/auth/v1/admin/users/') && request.method === 'PUT'
        : request.path.endsWith('/device_user_assignments') && request.method === 'POST'
    await assert.rejects(provisionDeviceCredentials(service, repair), (error) => {
      assert.equal(error.code, 'DEVICE_ACCESS_SETUP_UNKNOWN')
      assert.equal(error.details.outcome_unknown, true)
      assert.equal(error.details.failed_stage, stage)
      assert.ok(state.users.has(error.details.user_id))
      return true
    })
    assert.equal(state.requests.filter((request) => request.path === '/auth/v1/admin/users' && request.method === 'POST').length, 1)
    assert.ok(!state.requests.some((request) => request.method === 'DELETE'))
    if (stage !== 'enable_auth') assert.ok([...state.users.values()][0].banned_until)
    if (stage === 'assignment') await assert.rejects(provisionDeviceCredentials(service, repair), (error) => error.code === 'DEVICE_ACCESS_REVIEW' && Boolean(error.details.user_id))
    if (stage === 'enable_auth') assert.equal((await provisionDeviceCredentials(service, repair)).credentials_created, false)
    assert.equal(rows('devices').length, 1)
  }
})

test('failed automatic provisioning reports its retained device and incomplete Auth cleanup', async () => {
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), { fetchImpl: async (url, options) => {
    const path = new URL(url).pathname
    if (path.endsWith('/profiles') && options.method === 'POST') return new Response(JSON.stringify({ code: '23514', message: 'Invalid profile' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    if (options.method === 'DELETE') return new Response(JSON.stringify({ code: 'unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    return fixture.fetchImpl(url, options)
  } })
  await assert.rejects(service.execute('devices', 'create', create()), (error) => {
    assert.equal(error.code, 'DEVICE_ACCESS_SETUP_PARTIAL')
    assert.equal(error.details.device_created, true)
    assert.equal(error.details.auth_cleanup_complete, false)
    assert.ok(fixture.rows('devices').some((device) => device.id === error.details.device_id))
    assert.ok(fixture.state.users.get(error.details.user_id).banned_until)
    return true
  })
})

test('uncertain device creation returns the device ID before attempting Auth', async () => {
  const { service, state, rows } = setup()
  state.dropAfter = (request) => request.path.endsWith('/devices') && request.method === 'POST'
  await assert.rejects(service.execute('devices', 'create', create()), (error) => {
    assert.equal(error.details.outcome_unknown, true)
    assert.ok(rows('devices').some((device) => device.id === error.details.device_id))
    return true
  })
  assert.equal(state.users.size, 0)
})

test('concurrent repairs cannot create two Auth accounts for one terminal', async () => {
  const { service, state, rows } = setup()
  const results = await Promise.allSettled([provisionDeviceCredentials(service, repair), provisionDeviceCredentials(service, repair)])
  assert.ok(results.some((result) => result.status === 'fulfilled'))
  assert.equal(state.users.size, 1)
  assert.equal(rows('device_user_assignments').length, 1)
})

test('MCP creates usable device access and exposes a repair tool that preserves it', async (t) => {
  const { service, state } = setup()
  const server = createAlteilServer({ modules: [createTickitPosModule(service)] })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'device-access-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const tool = (await client.listTools()).tools.find((entry) => entry.name === 'tickit_pos_devices_credentials_create')
  assert.ok(tool.inputSchema.required.includes('device_id'))
  const result = await client.callTool({ name: 'tickit_pos_devices_create', arguments: create('satellite') })
  assert.ok(!result.isError, JSON.stringify(result))
  const device = result.structuredContent
  assert.equal(device.access.credentials_created, true)
  const repeat = await client.callTool({ name: 'tickit_pos_devices_credentials_create', arguments: { device_id: device.id, confirm: true } })
  assert.ok(!repeat.isError, JSON.stringify(repeat))
  assert.equal(repeat.structuredContent.credentials_created, false)
  assert.equal(state.users.size, 1)
})
