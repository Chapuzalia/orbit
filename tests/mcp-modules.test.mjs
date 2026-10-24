import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
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
  assert.ok(!tools.some((tool) => tool.name.startsWith('orbit_') || tool.name === 'tickit_pos_order_submit'))
  const modules = await call(client, 'alteil_modules')
  assert.equal(modules.modules[0].backend, 'supabase')
  assert.ok(!JSON.stringify(modules).includes(serviceRoleKey))
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
  const root = await call(client, 'tickit_pos_users_create', { email: 'root@example.com', password: 'Test-only-password-123', role: 'superadmin', confirm: true })
  assert.equal(root.is_superadmin, true)
  await call(client, 'tickit_pos_access_grant', { user_id: root.id, tenant_id: ids.otherTenant, role: 'owner', confirm: true })
  const user = await call(client, 'tickit_pos_users_get', { user_id: root.id })
  assert.equal(user.memberships[0].tenant_id, ids.otherTenant)
  await call(client, 'tickit_pos_access_revoke', { user_id: root.id, tenant_id: ids.otherTenant, confirm: true })
  const demoted = await call(client, 'tickit_pos_users_update', { user_id: root.id, is_superadmin: false, confirm: true })
  assert.equal(demoted.is_superadmin, false)
  assert.equal(demoted.memberships[0].is_active, false)
})
