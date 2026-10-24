import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import net from 'node:net'
import { request } from 'node:http'
import PocketBase from 'pocketbase'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { OrbitService, readConfig, safeError } from '../mcp/service.mjs'
import { createOrbitServer } from '../mcp/server.mjs'
import { createOrbitHttpServer } from '../mcp/http.mjs'

const root = resolve(import.meta.dirname, '..')
const config = { url: 'http://127.0.0.1:8090', email: 'mcp@example.com', password: 'Local-mcp-password-123', allowSecrets: false, readOnly: false }

async function connect(service, t) {
  const server = createOrbitServer(service)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'orbit-test', version: '1.0.0' })
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

test('configuration rejects remote cleartext, missing credentials and invalid protocols', () => {
  assert.throws(() => readConfig({}), /ORBIT_POCKETBASE_URL/)
  assert.throws(() => readConfig({ ORBIT_POCKETBASE_URL: 'http://example.com', ORBIT_USER_TOKEN: 'x' }), /HTTPS/)
  assert.throws(() => readConfig({ ORBIT_POCKETBASE_URL: 'ftp://example.com', ORBIT_USER_TOKEN: 'x' }), /inválida/)
  assert.equal(readConfig({ ORBIT_POCKETBASE_URL: config.url, ORBIT_USER_TOKEN: 'x' }).allowSecrets, false)
  assert.ok(!JSON.stringify(safeError({ status: 400, message: 'secret-password', response: { password: 'secret-password' } })).includes('secret-password'))
})

test('stdio negotiates MCP, discovers tools, resources and prompts without authenticating', { timeout: 15000 }, async (t) => {
  const client = new Client({ name: 'stdio-test', version: '1.0.0' })
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'mcp/index.mjs')], cwd: root,
    env: { PATH: process.env.PATH || process.env.Path || '', ORBIT_POCKETBASE_URL: config.url, ORBIT_USER_TOKEN: 'unused' }, stderr: 'pipe' })
  t.after(() => client.close())
  await client.connect(transport)
  const { tools } = await client.listTools()
  assert.ok(tools.length > 60)
  assert.ok(tools.some((tool) => tool.name === 'orbit_sales_commissions_update'))
  assert.ok(!tools.some((tool) => tool.name === 'orbit_credentials_reveal'))
  assert.equal((await client.listResources()).resources[0].uri, 'orbit://capabilities')
  assert.equal((await client.listPrompts()).prompts.length, 1)
  assert.deepEqual((await call(client, 'alteil_modules')).modules.map((module) => module.id), ['orbit'])
  const resource = await client.readResource({ uri: 'orbit://capabilities' })
  assert.ok(JSON.parse(resource.contents[0].text).entities.expenses)
  assert.equal((await call(client, 'orbit_capabilities')).read_only, false)
})

test('MCP against isolated PocketBase: business functions, roles, workspaces and transports', { timeout: 90000 }, async (t) => {
  const binary = process.env.POCKETBASE_TEST_BINARY || join(root, '.pocketbase-test', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')
  await mkdir(join(root, '.pocketbase-test'), { recursive: true })
  const directory = await mkdtemp(join(root, '.pocketbase-test', 'mcp-'))
  const args = [`--dir=${join(directory, 'data')}`, `--migrationsDir=${join(root, 'pocketbase/pb_migrations')}`, `--hooksDir=${join(root, 'pocketbase/pb_hooks')}`]
  for (const command of [['migrate', 'up'], ['superuser', 'upsert', 'test-admin@example.com', 'Local-admin-password-123']]) {
    const result = spawnSync(binary, [...command, ...args], { encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message)
  }
  const portServer = net.createServer()
  await new Promise((done) => portServer.listen(0, '127.0.0.1', done))
  const port = portServer.address().port
  await new Promise((done) => portServer.close(done))
  const child = spawn(binary, ['serve', `--http=127.0.0.1:${port}`, '--automigrate=0', '--hooksWatch=false', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(async () => { const closed = once(child, 'exit'); child.kill(); await closed })
  let logs = ''
  child.stdout.on('data', (data) => logs += data)
  child.stderr.on('data', (data) => logs += data)
  const url = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${url}/api/health`)).ok) break } catch {}
    if (attempt === 99) assert.fail(logs)
    await new Promise((done) => setTimeout(done, 100))
  }
  const admin = new PocketBase(url)
  await admin.collection('_superusers').authWithPassword('test-admin@example.com', 'Local-admin-password-123')
  const org = await admin.collection('organizations').create({ name: 'MCP A', currency: 'EUR' })
  const otherOrg = await admin.collection('organizations').create({ name: 'MCP B', currency: 'EUR' })
  const user = await admin.collection('users').create({ email: config.email, password: config.password, passwordConfirm: config.password, name: 'MCP user', role: 'admin', organization_id: org.id })
  await admin.collection('users').create({ email: 'member@example.com', password: config.password, passwordConfirm: config.password, role: 'user', organization_id: org.id })
  const foreign = await admin.collection('clients').create({ name: 'Other workspace', organization_id: otherOrg.id })
  const service = new OrbitService({ ...config, url })
  const client = await connect(service, t)

  await t.test('identity, client assignment, recurring billing, expenses and statistics', async () => {
    assert.equal((await call(client, 'orbit_whoami')).organization.id, org.id)
    const rep = await call(client, 'orbit_sales_reps_create', { data: { name: 'Rep A' } })
    const customer = await call(client, 'orbit_clients_create', { data: { name: 'Client A', status: 'active', sales_rep_id: rep.id, billing_cycle: 'monthly', billing_amount: 100 } })
    const expense = await call(client, 'orbit_expenses_create', { data: { name: 'Hosting', category: 'infrastructure', net_amount: 20, vat_type: 'rate', vat_rate: 21, billing_cycle: 'monthly', status: 'active' } })
    await call(client, 'orbit_expenses_update', { id: expense.id, data: { supplier: 'Supplier A' } })
    const report = await call(client, 'orbit_statistics', { horizon: 3 })
    assert.equal(report.overview.revenue, 100)
    assert.equal(report.overview.annualRevenue, 1200)
    assert.equal(report.overview.costs, 20)
    assert.equal(report.overview.profit, 80)
    assert.equal(report.forecast.length, 3)
    assert.equal(report.sales_reps.ranking[0].mrr, 100)
    const agreement = await call(client, 'orbit_sales_commissions_create', { data: { client_id: customer.id, sales_rep_id: rep.id, plan: 'pro', monthly_amount: 100, bonus_multiplier: 1, rate: 10, first_month: 3, last_month: 60, start_month: '2026-01', status: 'active', ended_month: 0,
      receipts: [{ month: 1, amount: 100, date: '2026-01-15' }, { month: 2, amount: 100, date: '2026-02-15' }, { month: 3, amount: 100, date: '2026-03-15' }] } })
    assert.equal((await call(client, 'orbit_commission_summary', { id: agreement.id })).summary.earned, 110)
    await call(client, 'orbit_sales_commissions_update', { id: agreement.id, data: { status: 'ended', ended_month: 3 } })
    assert.equal((await call(client, 'orbit_commission_summary', { id: agreement.id })).summary.clawback, 100)
    const invoice = await call(client, 'orbit_invoices_create', { data: { number: 'F-1', client_id: customer.id, amount: 100, status: 'sent', issued: '2026-10-01' } })
    await call(client, 'orbit_payments_create', { data: { invoice_id: invoice.id, client_id: customer.id, amount: 100, method: 'transfer', date: '2026-10-02', status: 'completed' } })
    await call(client, 'orbit_subscriptions_create', { data: { client_id: customer.id, plan: 'Pro', amount: 100, interval: 'month', status: 'active' } })
    const list = await call(client, 'orbit_clients_list', { filters: [{ field: 'name', operator: 'contains', value: 'Client' }], per_page: 1 })
    assert.equal(list.items[0].id, customer.id)
    assert.equal(list.totalItems, 1)
    // User values must be escaped, not interpreted as PocketBase filter expressions.
    assert.equal((await call(client, 'orbit_clients_list', { filters: [{ field: 'name', operator: 'eq', value: '" || id != "' }] })).items.length, 0)
  })

  await t.test('workspace boundaries and immutable system fields', async () => {
    for (const name of ['orbit_clients_get', 'orbit_clients_update', 'orbit_clients_delete']) {
      const result = await client.callTool({ name, arguments: { id: foreign.id, ...(name.endsWith('update') ? { data: { name: 'hacked' } } : {}), ...(name.endsWith('delete') ? { confirm: true } : {}) } })
      assert.equal(result.isError, true)
    }
    assert.equal((await admin.collection('clients').getOne(foreign.id)).name, 'Other workspace')
    const invalid = await client.callTool({ name: 'orbit_clients_create', arguments: { data: { name: 'Invalid', organization_id: otherOrg.id } } })
    assert.equal(invalid.isError, true)
    const badSort = await client.callTool({ name: 'orbit_clients_list', arguments: { sort: [{ field: 'organization_id', direction: 'asc' }] } })
    assert.equal(badSort.isError, true)
    await assert.rejects(new OrbitService({ ...config, url, organizationId: otherOrg.id }).identity(), /workspace/)
  })

  await t.test('credential CRUD redacts secrets; revealing requires operator permission', async () => {
    const credential = await call(client, 'orbit_credentials_create', { data: { name: 'Mail', category: 'email', password: 'secret123', recovery: 'recovery123', notes: 'private note' } })
    assert.equal(credential.password, undefined)
    assert.equal(credential.notes, undefined)
    assert.equal(credential.created_by, user.id)
    assert.equal((await call(client, 'orbit_credentials_get', { id: credential.id })).recovery, undefined)
    assert.ok(!JSON.stringify(await call(client, 'orbit_credentials_list')).includes('secret123'))
    await assert.rejects(service.revealCredential(credential.id), /ALLOW_SECRETS/)
    const secretsClient = await connect(new OrbitService({ ...config, url, allowSecrets: true }), t)
    assert.equal((await call(secretsClient, 'orbit_credentials_reveal', { id: credential.id })).password, 'secret123')
    assert.equal((await client.callTool({ name: 'orbit_credentials_delete', arguments: { id: credential.id } })).isError, true)
    await call(client, 'orbit_credentials_delete', { id: credential.id, confirm: true })
  })

  await t.test('profile, workspace, preferences, notifications and integration rules', async () => {
    await call(client, 'orbit_profile_update', { data: { name: 'Agent account' } })
    await call(client, 'orbit_organization_update', { data: { name: 'MCP workspace' } })
    await call(client, 'orbit_preferences_save', { data: { notifications: { email: true }, theme: 'dark' } })
    await call(client, 'orbit_preferences_save', { data: { theme: 'light' } })
    await call(client, 'orbit_preferences_save', { data: { notifications: { push: true } } })
    assert.equal((await call(client, 'orbit_preferences_get')).preferences.theme, 'light')
    assert.equal((await call(client, 'orbit_preferences_get')).preferences.notifications.email, true)
    await admin.collection('notifications').create({ organization_id: org.id, user_id: user.id, title: 'Test' })
    assert.equal((await call(client, 'orbit_notifications_mark_all_read')).updated, 1)
    const integration = await call(client, 'orbit_integrations_create', { data: { name: 'Stripe', connected: false } })
    await call(client, 'orbit_integrations_update', { id: integration.id, data: { connected: true } })
    const member = await connect(new OrbitService({ ...config, url, email: 'member@example.com' }), t)
    assert.equal((await member.callTool({ name: 'orbit_organization_update', arguments: { data: { name: 'Forbidden' } } })).isError, true)
    assert.equal((await member.callTool({ name: 'orbit_integrations_update', arguments: { id: integration.id, data: { connected: false } } })).isError, true)
    const readOnly = new OrbitService({ ...config, url, readOnly: true })
    const readonlyClient = await connect(readOnly, t)
    assert.ok((await readonlyClient.listTools()).tools.every((tool) => tool.annotations.readOnlyHint))
    await assert.rejects(readOnly.execute('clients', 'create', { data: { name: 'No' } }), /solo lectura/)
    const userToken = new PocketBase(url)
    await userToken.collection('users').authWithPassword(config.email, config.password)
    assert.equal((await new OrbitService({ ...config, url, token: userToken.authStore.token }).identity()).user.id, user.id)
    await assert.rejects(new OrbitService({ ...config, url, token: admin.authStore.token }).identity())
  })

  await t.test('server registration returns one token, metrics stay read-only', async () => {
    const created = await call(client, 'orbit_servers_create', { data: { name: 'VPS A' } })
    assert.match(created.agent_token, /^[\w-]{43}$/)
    assert.equal(created.server.agent_token_hash, undefined)
    const response = await fetch(`${url}/api/orbit/server-metrics`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${created.agent_token}` }, body: JSON.stringify({ server_id: created.server.id, cpu: 30, ram: 40, disk: 50 }) })
    assert.equal(response.status, 200)
    const metrics = await call(client, 'orbit_server_metrics_list', { filters: [{ field: 'server_id', operator: 'eq', value: created.server.id }] })
    assert.equal(metrics.items[0].cpu, 30)
    const listed = await call(client, 'orbit_servers_get', { id: created.server.id })
    assert.equal(listed.agent_token_hash, undefined)
    assert.equal(listed.agent_token, undefined)
    assert.equal(listed.effective_status, 'operational')
    await admin.collection('servers').update(created.server.id, { last_check: '2020-01-01 00:00:00Z' })
    assert.equal((await call(client, 'orbit_servers_get', { id: created.server.id })).effective_status, 'offline')
  })

  await t.test('Streamable HTTP authenticates and rejects hostile hosts, origins and malformed bodies', async () => {
    const token = 'test-token-with-at-least-32-characters'
    const http = createOrbitHttpServer(service, { token })
    await new Promise((done) => http.listen(0, '127.0.0.1', done))
    t.after(() => { http.close(); http.closeAllConnections() })
    const endpoint = new URL(`http://127.0.0.1:${http.address().port}/mcp`)
    assert.equal((await fetch(endpoint, { method: 'POST' })).status, 401)
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://evil.example' } })).status, 403)
    const invalidHost = await new Promise((done, reject) => {
      const req = request(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Host: 'evil.example' } }, (res) => { res.resume(); done(res.statusCode) })
      req.on('error', reject)
      req.end()
    })
    assert.equal(invalidHost, 403)
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{broken' })).status, 400)
    const httpClient = new Client({ name: 'http-test', version: '1.0.0' })
    t.after(() => httpClient.close())
    await httpClient.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
    assert.equal((await call(httpClient, 'orbit_whoami')).user.id, user.id)
    assert.ok((await httpClient.listTools()).tools.length > 60)
    assert.throws(() => createOrbitHttpServer(service, { token: 'short' }), /32/)
  })
})
