import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { readCoreConfig } from '../mcp/core/config.mjs'
import { loadModules } from '../mcp/core/registry.mjs'
import { createAlteilServer } from '../mcp/core/server.mjs'
import { createAlteilHttpServer } from '../mcp/transports/http.mjs'
import { createOrbitModule } from '../mcp/modules/orbit/index.mjs'
import { createTickitPosModule } from '../mcp/modules/tickit-pos/index.mjs'
import { createMessModule } from '../mcp/modules/mess/index.mjs'
import { TickitPosService, readTickitConfig } from '../mcp/modules/tickit-pos/service.mjs'
import { createSupabaseFixture, tickitEnv, serviceRoleKey, ids } from './helpers/tickit-supabase.mjs'

const fakeOrbit = () => ({ config: { readOnly: false, allowSecrets: false }, identity: async () => ({ user: { id: 'orbit-user' }, organization: { id: 'orbit-workspace' } }) })
async function connect(modules, t, options = {}) {
  const server = createAlteilServer({ modules, ...options })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'module-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return client
}
const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name, arguments: args })
  assert.ok(!result.isError, JSON.stringify(result))
  return result.structuredContent
}

test('module selection, legacy transport aliases and direct Supabase staging configuration', async () => {
  assert.deepEqual(readCoreConfig({}).modules, ['orbit'])
  assert.equal(readCoreConfig({ ORBIT_MCP_TRANSPORT: 'http' }).transport, 'http')
  assert.equal(readCoreConfig({ ORBIT_MCP_TRANSPORT: 'http', ALTEIL_MCP_TRANSPORT: 'stdio' }).transport, 'stdio')
  assert.throws(() => readCoreConfig({ ALTEIL_MODULES: 'orbit,orbit' }), /únicos/)
  await assert.rejects(loadModules(readCoreConfig({ ALTEIL_MODULES: '../evil' }), {}), /desconocido/)
  const modules = await loadModules(readCoreConfig(tickitEnv), tickitEnv)
  assert.deepEqual(modules.map((module) => module.id), ['tickit_pos'])
  assert.equal(modules[0].config.environment, 'staging')
  assert.throws(() => readTickitConfig({ ...tickitEnv, TICKIT_POS_ENVIRONMENT: 'production' }), /staging/)
  assert.throws(() => readTickitConfig({ ...tickitEnv, TICKIT_POS_SUPABASE_URL: 'http://remote.example.com' }), /HTTPS/)
  assert.throws(() => readTickitConfig({ ...tickitEnv, TICKIT_POS_SERVICE_ROLE_KEY: `test.${Buffer.from('{"role":"anon"}').toString('base64url')}.test` }), /service_role/)
  assert.equal(readTickitConfig({ ...tickitEnv, TICKIT_POS_TENANT_ID: ids.tenant, TICKIT_POS_VENUE_ID: ids.venue }).tenantId, undefined)
  assert.equal(readTickitConfig(tickitEnv).access, 'platform_superadmin')
  assert.equal(readTickitConfig({ ...tickitEnv, TICKIT_POS_SERVICE_ROLE_KEY: 'sb_secret_test' }).serviceRoleKey, 'sb_secret_test')
})

test('stdio exposes administrative Tickit tools without Orbit or Express credentials', { timeout: 15000 }, async (t) => {
  const client = new Client({ name: 'tickit-stdio', version: '1.0.0' })
  t.after(() => client.close())
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('mcp/index.mjs')], env: { PATH: process.env.PATH || process.env.Path || '', ...tickitEnv }, stderr: 'pipe' }))
  const { tools } = await client.listTools()
  for (const name of ['tickit_pos_users_create', 'tickit_pos_access_grant', 'tickit_pos_products_create', 'tickit_pos_devices_create']) assert.ok(tools.some((tool) => tool.name === name), name)
  const ownerInput = tools.find((tool) => tool.name === 'tickit_pos_users_create').inputSchema
  for (const field of ['email', 'password', 'role', 'tenant_id', 'confirm']) assert.ok(ownerInput.properties?.[field], field)
  const addonInput = tools.find((tool) => tool.name === 'tickit_pos_platform_tenant_configure').inputSchema.properties.feature_keys
  assert.ok(addonInput.items.enum.includes('restaurant'))
  assert.ok(addonInput.items.enum.includes('analytics_advanced'))
  for (const key of ['catalog', 'quick_sale', 'discounts', '__assist_catalog_v1']) assert.ok(!addonInput.items.enum.includes(key))
  assert.ok(!tools.some((tool) => tool.name.startsWith('orbit_') || tool.name === 'tickit_pos_order_submit'))
  const modules = await call(client, 'alteil_modules')
  assert.equal(modules.modules[0].backend, 'supabase')
  assert.ok(!JSON.stringify(modules).includes(serviceRoleKey))
})

test('tool discovery exposes refined schemas and supports creating a tenant owner', async (t) => {
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), fixture)
  const client = await connect([createTickitPosModule(service), createMessModule({ config: { authCollection: 'users', readOnly: false } })], t)
  const { tools } = await client.listTools()
  for (const [name, fields, required] of [
    ['tickit_pos_users_create', ['email', 'password', 'full_name', 'tenant_id', 'role', 'venue_ids', 'device_id', 'email_confirm', 'confirm'], ['email', 'confirm']],
    ['tickit_pos_access_grant', ['user_id', 'tenant_id', 'role', 'venue_ids', 'device_id', 'confirm'], ['user_id', 'tenant_id', 'role', 'confirm']],
    ['mess_reservations_list', ['from', 'to', 'search', 'waiter_id', 'needs_dj', 'deposit_paid', 'page', 'per_page'], []],
  ]) {
    const schema = tools.find((tool) => tool.name === name).inputSchema
    for (const field of fields) assert.ok(schema.properties?.[field], `${name} must advertise ${field}`)
    for (const field of required) assert.ok(schema.required.includes(field), `${name} must require ${field}`)
    assert.equal(schema.additionalProperties, false)
  }
  const ownerSchema = tools.find((tool) => tool.name === 'tickit_pos_users_create').inputSchema
  assert.ok(ownerSchema.properties.role.enum.includes('owner'))
  assert.ok(!ownerSchema.required.includes('password'))
  assert.equal(ownerSchema.properties.email_confirm.default, true)
  const owner = await call(client, 'tickit_pos_users_create', {
    email: 'owner@example.com', full_name: 'Tenant owner', role: 'owner', tenant_id: ids.tenant, confirm: true,
  })
  assert.equal(owner.memberships[0].tenant_id, ids.tenant)
  assert.equal(owner.memberships[0].role, 'owner')
  assert.equal(fixture.state.users.get(owner.id).banned_until, null)
  assert.equal(fixture.state.requests.find((request) => request.method === 'POST' && request.path === '/auth/v1/admin/users').body.password, 'ay654Dfg')
})

test('publishing refined object fields preserves cross-field validation before the handler', async (t) => {
  let calls = 0
  const module = {
    id: 'validation', version: '1.0.0', config: { readOnly: false }, health: async () => ({ connected: true }),
    register({ register }) {
      const schema = z.object({ from: z.number(), to: z.number() }).strict()
        .refine((value) => value.from <= value.to, 'Invalid range')
        .superRefine(async (value, ctx) => { if (value.to > 10) ctx.addIssue({ code: 'custom', message: 'Range too large' }) })
      register('validation_range', 'Validates a range.', schema, async (input) => { calls++; return input }, { readOnly: true })
    },
  }
  const client = await connect([module], t)
  const schema = (await client.listTools()).tools.find((tool) => tool.name === 'validation_range').inputSchema
  assert.deepEqual(Object.keys(schema.properties), ['from', 'to'])
  for (const input of [{ from: 2, to: 1 }, { from: 1, to: 11 }, { from: 1, to: 2, extra: true }]) {
    assert.equal((await client.callTool({ name: 'validation_range', arguments: input })).isError, true)
  }
  assert.equal(calls, 0)
  assert.deepEqual(await call(client, 'validation_range', { from: 1, to: 2 }), { from: 1, to: 2 })
  assert.equal(calls, 1)
})

test('both products share one endpoint while errors and catalogs remain independent', async (t) => {
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), fixture)
  const modules = [createOrbitModule(fakeOrbit()), createTickitPosModule(service)]
  const client = await connect(modules, t)
  assert.deepEqual((await call(client, 'alteil_modules')).modules.map((module) => module.id), ['orbit', 'tickit_pos'])
  assert.ok((await call(client, 'orbit_capabilities')).tools.every((tool) => tool.module === 'orbit'))
  assert.equal((await call(client, 'alteil_module_health', { module: 'tickit_pos' })).connected, true)
  fixture.state.fail = () => true
  assert.equal((await call(client, 'alteil_module_health', { module: 'tickit_pos' })).connected, false)
  assert.equal((await call(client, 'orbit_whoami')).organization.id, 'orbit-workspace')
  fixture.state.fail = null
  const token = 'local-mcp-token-with-at-least-32-characters'
  const http = createAlteilHttpServer(() => createAlteilServer({ modules }), { token })
  await new Promise((done) => http.listen(0, '127.0.0.1', done))
  t.after(() => { http.close(); http.closeAllConnections() })
  const remote = new Client({ name: 'mixed-http', version: '1.0.0' })
  t.after(() => remote.close())
  await remote.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${http.address().port}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
  assert.equal((await call(remote, 'tickit_pos_capabilities')).access, 'platform_superadmin')
  assert.equal((await call(remote, 'tickit_pos_tenants_list')).items.length, 2)
})

test('write permissions apply per product, globally and at execution time', async (t) => {
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), fixture)
  const orbit = createOrbitModule(fakeOrbit())
  orbit.config.readOnly = true
  const client = await connect([orbit, createTickitPosModule(service)], t)
  const { tools } = await client.listTools()
  assert.ok(!tools.some((tool) => tool.name === 'orbit_clients_create'))
  assert.ok(tools.some((tool) => tool.name === 'tickit_pos_products_create'))
  service.config.readOnly = true
  const denied = await client.callTool({ name: 'tickit_pos_devices_create', arguments: { data: { name: 'POS', device_mode: 'checkout' }, confirm: true } })
  assert.equal(denied.isError, true)
  assert.equal(fixture.state.requests.length, 0)
  const readOnly = await connect([createOrbitModule(fakeOrbit()), createTickitPosModule(service)], t, { readOnly: true })
  assert.ok((await readOnly.listTools()).tools.every((tool) => tool.annotations.readOnlyHint))
})

test('MCP exposes global superadmin creation, cross-company access and explicit revocation targets', async (t) => {
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), fixture)
  const client = await connect([createTickitPosModule(service)], t)
  const root = await call(client, 'tickit_pos_users_create', { email: 'root@example.com', role: 'superadmin', confirm: true })
  assert.equal(root.is_superadmin, true)
  assert.equal(fixture.state.requests.find((request) => request.method === 'POST' && request.path === '/auth/v1/admin/users').body.password, 'ay654Dfg')
  await call(client, 'tickit_pos_access_grant', { user_id: root.id, tenant_id: ids.otherTenant, role: 'owner', confirm: true })
  const user = await call(client, 'tickit_pos_users_get', { user_id: root.id })
  assert.equal(user.memberships[0].tenant_id, ids.otherTenant)
  await call(client, 'tickit_pos_access_revoke', { user_id: root.id, tenant_id: ids.otherTenant, confirm: true })
  const demoted = await call(client, 'tickit_pos_users_update', { user_id: root.id, is_superadmin: false, confirm: true })
  assert.equal(demoted.is_superadmin, false)
  assert.equal(demoted.memberships[0].is_active, false)
})
