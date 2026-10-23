import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, copyFile, readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { resolve, join } from 'node:path'
import net from 'node:net'
import PocketBase from 'pocketbase'
import { requireWorkspace } from '../lib/workspace.mjs'
import { fetchServerMetricHistory, SERVER_METRIC_POINTS } from '../lib/server-metrics.mjs'

const root = resolve(import.meta.dirname, '..')
const binary = process.env.POCKETBASE_TEST_BINARY || join(root, '.pocketbase-test', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')

test('empty installation, new accounts, workspace rules, CRUD and monitoring', { timeout: 60000 }, async (t) => {
  await mkdir(join(root, '.pocketbase-test'), { recursive: true })
  const directory = await mkdtemp(join(root, '.pocketbase-test', 'integration-'))
  const migrations = join(directory, 'migrations')
  await mkdir(migrations)
  await copyFile(join(root, 'pocketbase/pb_migrations/1792022400_orbit_initial.js'), join(migrations, '1792022400_orbit_initial.js'))
  const args = [`--dir=${join(directory, 'data')}`, `--migrationsDir=${migrations}`, `--hooksDir=${join(root, 'pocketbase/pb_hooks')}`]
  const run = (...command) => {
    const result = spawnSync(binary, [...command, ...args], { encoding: 'utf8', windowsHide: true, input: command[1] === 'down' ? 'y\n' : undefined })
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message)
  }
  run('migrate', 'up')
  run('migrate', 'down', '1')
  run('migrate', 'up')
  // Apply the new migration to an existing, populated installation.
  const seedDb = new DatabaseSync(join(directory, 'data', 'data.db'))
  seedDb.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run('existingorg0001', 'Existing workspace')
  seedDb.prepare('INSERT INTO clients (id, organization_id, name) VALUES (?, ?, ?)').run('existingcli0001', 'existingorg0001', 'Existing client')
  seedDb.close()
  await copyFile(join(root, 'pocketbase/pb_migrations/1792713600_sales_reps.js'), join(migrations, '1792713600_sales_reps.js'))
  run('migrate', 'up')
  const checkUpgrade = () => {
    const db = new DatabaseSync(join(directory, 'data', 'data.db'))
    assert.equal(db.prepare('SELECT sales_rep_id FROM clients WHERE id = ?').get('existingcli0001').sales_rep_id, '')
    db.close()
  }
  checkUpgrade()
  run('migrate', 'down', '1')
  const rollbackDb = new DatabaseSync(join(directory, 'data', 'data.db'))
  assert.equal(rollbackDb.prepare('SELECT name FROM clients WHERE id = ?').get('existingcli0001').name, 'Existing client')
  rollbackDb.close()
  run('migrate', 'up')
  checkUpgrade()
  await copyFile(join(root, 'pocketbase/pb_migrations/1792717200_client_billing.js'), join(migrations, '1792717200_client_billing.js'))
  run('migrate', 'up')
  const billingUpgradeDb = new DatabaseSync(join(directory, 'data', 'data.db'))
  const existingClient = billingUpgradeDb.prepare('SELECT name, sales_rep_id, billing_cycle, billing_amount FROM clients WHERE id = ?').get('existingcli0001')
  assert.equal(existingClient.name, 'Existing client')
  assert.equal(existingClient.sales_rep_id, '')
  assert.equal(existingClient.billing_cycle, '')
  assert.equal(existingClient.billing_amount, 0)
  billingUpgradeDb.close()
  run('migrate', 'down', '1')
  const billingRollbackDb = new DatabaseSync(join(directory, 'data', 'data.db'))
  assert.equal(billingRollbackDb.prepare('SELECT name FROM clients WHERE id = ?').get('existingcli0001').name, 'Existing client')
  billingRollbackDb.close()
  run('migrate', 'up')
  await copyFile(join(root, 'pocketbase/pb_migrations/1792720800_expenses.js'), join(migrations, '1792720800_expenses.js'))
  run('migrate', 'up')
  run('migrate', 'down', '1')
  run('migrate', 'up')
  const expensesUpgradeDb = new DatabaseSync(join(directory, 'data', 'data.db'))
  assert.equal(expensesUpgradeDb.prepare('SELECT name FROM clients WHERE id = ?').get('existingcli0001').name, 'Existing client')
  assert.equal(expensesUpgradeDb.prepare('SELECT COUNT(*) AS count FROM expenses').get().count, 0)
  expensesUpgradeDb.close()
  const cleanupDb = new DatabaseSync(join(directory, 'data', 'data.db'))
  cleanupDb.prepare('DELETE FROM clients WHERE id = ?').run('existingcli0001')
  cleanupDb.prepare('DELETE FROM organizations WHERE id = ?').run('existingorg0001')
  cleanupDb.close()
  run('superuser', 'upsert', 'service@example.com', 'Local-service-password-123')
  const portServer = net.createServer()
  await new Promise((done) => portServer.listen(0, '127.0.0.1', done))
  const port = portServer.address().port
  await new Promise((done) => portServer.close(done))
  const child = spawn(binary, ['serve', `--http=127.0.0.1:${port}`, '--automigrate=0', '--hooksWatch=false', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  child.stdout.on('data', (data) => logs += data)
  child.stderr.on('data', (data) => logs += data)
  t.after(() => child.kill())
  const url = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${url}/api/health`)).ok) break } catch {}
    if (attempt === 99) assert.fail(logs)
    await new Promise((done) => setTimeout(done, 100))
  }
  const service = new PocketBase(url)
  service.autoCancellation(false)
  await service.collection('_superusers').authWithPassword('service@example.com', 'Local-service-password-123')
  const tables = ['users', 'organizations', 'clients', 'sales_reps', 'servers', 'server_metrics', 'invoices', 'payments', 'subscriptions', 'revenue_by_month', 'notifications', 'activity', 'user_preferences', 'integrations', 'credentials', 'expenses']
  for (const table of tables) assert.equal((await service.collection(table).getList(1, 1)).totalItems, 0, `${table} must start empty`)
  const collections = await service.collections.getFullList()
  for (const name of ['members', 'projects', 'tasks', 'meetings', 'repositories', 'pull_requests', 'commits', 'workflows', 'milestones', 'todo_lists', 'todo_items']) assert.ok(!collections.some((collection) => collection.name === name))
  for (const collection of collections.filter((collection) => tables.includes(collection.name))) assert.ok(!collection.fields.some((field) => field.name === 'legacy_id'))

  const orgA = await service.collection('organizations').create({ name: 'Orbit A', plan: 'Business', currency: 'EUR' })
  const orgB = await service.collection('organizations').create({ name: 'Orbit B', plan: 'Business', currency: 'EUR' })
  const password = 'New-local-password-123'
  const userA = await service.collection('users').create({ name: 'Alice', email: 'alice@example.com', password, passwordConfirm: password, role: 'admin', organization_id: orgA.id })
  const userB = await service.collection('users').create({ name: 'Bob', email: 'bob@example.com', password, passwordConfirm: password, role: 'user', organization_id: orgB.id })
  const alice = new PocketBase(url)
  const bob = new PocketBase(url)
  await alice.collection('users').authWithPassword(userA.email, password)
  await bob.collection('users').authWithPassword(userB.email, password)
  await alice.collection('users').authRefresh()
  const clientA = await alice.collection('clients').create({ organization_id: orgA.id, name: 'Cliente A', status: 'active' })
  const clientB = await bob.collection('clients').create({ organization_id: orgB.id, name: 'Cliente B' })
  assert.equal((await alice.collection('clients').getFullList()).length, 1)
  await assert.rejects(alice.collection('clients').getOne(clientB.id))
  await assert.rejects(alice.collection('users').update(userA.id, { organization_id: orgB.id }))
  await assert.rejects(bob.collection('users').update(userB.id, { role: 'admin' }))
  assert.equal((await new PocketBase(url).collection('clients').getFullList()).length, 0)
  await assert.rejects(new PocketBase(url).collection('users').create({ email: 'public@example.com', password, passwordConfirm: password, role: 'admin', organization_id: orgA.id }))
  await t.test('expense CRUD, IVA precision, cycles and workspace isolation', async () => {
    const values = { organization_id: orgA.id, name: 'Hosting', supplier: 'Proveedor', category: 'infrastructure', net_amount: 100.99, vat_type: 'rate', vat_rate: 21, billing_cycle: 'monthly', status: 'active', charge_date: '2026-11-01 12:00:00.000Z', notes: 'Notes' }
    const created = await alice.collection('expenses').create(values)
    assert.equal(created.net_amount, 100.99)
    assert.equal(created.vat_rate, 21)
    assert.ok(created.charge_date.startsWith('2026-11-01'))
    for (const billing_cycle of ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'one_time']) assert.equal((await alice.collection('expenses').update(created.id, { billing_cycle })).billing_cycle, billing_cycle)
    assert.equal((await alice.collection('expenses').update(created.id, { vat_rate: 7.5, status: 'paused', charge_date: '' })).vat_rate, 7.5)
    const reloaded = await alice.collection('expenses').getOne(created.id)
    assert.equal(reloaded.status, 'paused')
    assert.equal(reloaded.charge_date, '')
    for (const vat_type of ['exempt', 'not_subject', 'reverse_charge']) {
      await assert.rejects(alice.collection('expenses').update(created.id, { vat_type, vat_rate: 21 }))
      const updated = await alice.collection('expenses').update(created.id, { vat_type, vat_rate: 0 })
      assert.equal(updated.vat_type, vat_type)
      assert.equal(updated.vat_rate, 0)
    }
    for (const invalid of [{ name: ' ' }, { net_amount: -1 }, { net_amount: 10.001 }, { net_amount: 1000000000 }, { vat_type: 'rate', vat_rate: -1 }, { vat_type: 'rate', vat_rate: 101 }, { vat_type: 'rate', vat_rate: 7.555 }, { category: 'invalid' }, { billing_cycle: 'none' }, { status: 'invalid' }, { vat_type: 'invalid' }]) {
      await assert.rejects(alice.collection('expenses').create({ ...values, ...invalid }), undefined, JSON.stringify(invalid))
      await assert.rejects(alice.collection('expenses').update(created.id, invalid), undefined, JSON.stringify(invalid))
    }
    const foreign = await bob.collection('expenses').create({ ...values, organization_id: orgB.id })
    assert.equal((await alice.collection('expenses').getFullList()).length, 1)
    await assert.rejects(alice.collection('expenses').getOne(foreign.id))
    await assert.rejects(alice.collection('expenses').update(foreign.id, { name: 'Changed' }))
    await assert.rejects(alice.collection('expenses').delete(foreign.id))
    await assert.rejects(alice.collection('expenses').create({ ...values, organization_id: orgB.id }))
    await assert.rejects(alice.collection('expenses').update(created.id, { organization_id: orgB.id }))
    const anonymous = new PocketBase(url)
    assert.equal((await anonymous.collection('expenses').getFullList()).length, 0)
    await assert.rejects(anonymous.collection('expenses').create(values))
    await assert.rejects(anonymous.collection('expenses').update(created.id, { name: 'Changed' }))
    await alice.collection('expenses').delete(created.id)
    await bob.collection('expenses').delete(foreign.id)
    assert.equal((await alice.collection('expenses').getFullList()).length, 0)
  })

  await t.test('client billing persists valid cycles and cents and rejects invalid or foreign writes', async () => {
    assert.equal(clientA.billing_cycle, '')
    assert.equal(clientA.billing_amount, 0)
    for (const billing_cycle of ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'one_time']) {
      const updated = await alice.collection('clients').update(clientA.id, { billing_cycle, billing_amount: 123.45 })
      assert.equal(updated.billing_cycle, billing_cycle)
      assert.equal(updated.billing_amount, 123.45)
    }
    const created = await alice.collection('clients').create({ organization_id: orgA.id, name: 'Recurring client', status: 'active', billing_cycle: 'annual', billing_amount: 1200.99 })
    const reloaded = await alice.collection('clients').getOne(created.id)
    assert.equal(reloaded.billing_cycle, 'annual')
    assert.equal(reloaded.billing_amount, 1200.99)
    for (const billing_amount of [-1, 10.123, 1000000000]) {
      await assert.rejects(alice.collection('clients').update(clientA.id, { billing_cycle: 'monthly', billing_amount }))
      await assert.rejects(alice.collection('clients').create({ organization_id: orgA.id, name: 'Invalid amount', billing_cycle: 'monthly', billing_amount }))
    }
    await assert.rejects(alice.collection('clients').update(clientA.id, { billing_cycle: 'invalid', billing_amount: 10 }))
    await assert.rejects(alice.collection('clients').update(clientA.id, { billing_cycle: 'none', billing_amount: 10 }))
    await assert.rejects(alice.collection('clients').update(clientB.id, { billing_cycle: 'monthly', billing_amount: 10 }))
    await assert.rejects(bob.collection('clients').update(clientA.id, { billing_cycle: 'monthly', billing_amount: 10 }))
    await assert.rejects(new PocketBase(url).collection('clients').update(clientA.id, { billing_cycle: 'monthly', billing_amount: 10 }))
    const cleared = await alice.collection('clients').update(clientA.id, { billing_cycle: 'none', billing_amount: 0 })
    assert.equal(cleared.billing_cycle, 'none')
    assert.equal(cleared.billing_amount, 0)
    await alice.collection('clients').delete(created.id)
  })

  await t.test('sales reps support optional single assignments, reassignment and workspace isolation', async () => {
    const reps = alice.collection('sales_reps')
    const first = await reps.create({ organization_id: orgA.id, name: 'Ana', email: 'ana@example.com', phone: '600123456', notes: 'Zona norte' })
    const second = await reps.create({ organization_id: orgA.id, name: 'Luis' })
    const foreign = await bob.collection('sales_reps').create({ organization_id: orgB.id, name: 'Foreign rep' })
    assert.equal((await alice.collection('clients').getOne(clientA.id)).sales_rep_id, '')
    assert.equal((await reps.update(first.id, { name: 'Ana García' })).name, 'Ana García')
    assert.equal((await alice.collection('clients').getFullList({ filter: `sales_rep_id = "${first.id}"` })).length, 0)
    const extra = await alice.collection('clients').create({ organization_id: orgA.id, name: 'Assigned at creation', sales_rep_id: first.id })
    await alice.collection('clients').update(clientA.id, { sales_rep_id: first.id })
    assert.equal((await alice.collection('clients').getFullList({ filter: `sales_rep_id = "${first.id}"` })).length, 2)
    await alice.collection('clients').update(clientA.id, { sales_rep_id: second.id })
    assert.equal((await alice.collection('clients').getOne(clientA.id)).sales_rep_id, second.id)
    await alice.collection('clients').update(clientA.id, { sales_rep_id: '' })
    assert.equal((await alice.collection('clients').getOne(clientA.id)).sales_rep_id, '')
    const singleAssignment = await alice.collection('clients').update(clientA.id, { sales_rep_id: [first.id, second.id] })
    assert.equal(typeof singleAssignment.sales_rep_id, 'string')
    assert.ok([first.id, second.id].includes(singleAssignment.sales_rep_id))
    await assert.rejects(alice.collection('clients').update(clientA.id, { sales_rep_id: 'missingrep00001' }))
    await assert.rejects(alice.collection('clients').create({ organization_id: orgA.id, name: 'Invalid assignment', sales_rep_id: foreign.id }))
    await assert.rejects(alice.collection('clients').update(clientA.id, { sales_rep_id: foreign.id }))
    await assert.rejects(bob.collection('clients').update(clientB.id, { sales_rep_id: first.id }))
    await assert.rejects(reps.getOne(foreign.id))
    await assert.rejects(reps.update(foreign.id, { name: 'Changed' }))
    await assert.rejects(reps.delete(foreign.id))
    await assert.rejects(reps.create({ organization_id: orgB.id, name: 'Forbidden' }))
    await assert.rejects(reps.update(first.id, { organization_id: orgB.id }))
    await assert.rejects(reps.create({ organization_id: orgA.id, name: '' }))
    const anonymous = new PocketBase(url)
    assert.equal((await anonymous.collection('sales_reps').getFullList()).length, 0)
    await assert.rejects(anonymous.collection('sales_reps').create({ organization_id: orgA.id, name: 'Anonymous' }))
    await reps.delete(first.id)
    const preserved = await alice.collection('clients').getOne(extra.id)
    assert.equal(preserved.name, 'Assigned at creation')
    assert.equal(preserved.sales_rep_id, '')
    await alice.collection('clients').delete(extra.id)
    await reps.delete(second.id)
    await bob.collection('sales_reps').delete(foreign.id)
  })

  const invoice = await alice.collection('invoices').create({ organization_id: orgA.id, client_id: clientA.id, number: 'F-2026/001', amount: 125.5, status: 'sent' })
  const payment = await alice.collection('payments').create({ organization_id: orgA.id, client_id: clientA.id, invoice_id: invoice.id, amount: 100 })
  assert.equal(payment.invoice_id, invoice.id)
  await assert.rejects(alice.collection('invoices').create({ organization_id: orgA.id, client_id: clientB.id }))

  const credential = await alice.collection('credentials').create({ organization_id: orgA.id, created_by: userA.id, name: 'Nueva', password: 'secret' })
  await alice.collection('credentials').update(credential.id, { password: 'changed' })
  assert.equal((await alice.collection('credentials').getOne(credential.id)).password, 'changed')
  assert.equal((await bob.collection('credentials').getFullList()).length, 0)
  await assert.rejects(alice.collection('credentials').create({ organization_id: orgA.id, created_by: userB.id, name: 'Foreign' }))
  await alice.collection('credentials').delete(credential.id)
  const notice = await service.collection('notifications').create({ organization_id: orgA.id, user_id: userA.id, type: 'invoice', title: 'Factura', href: '/billing' })
  await alice.collection('notifications').update(notice.id, { read: true })
  await assert.rejects(alice.collection('notifications').update(notice.id, { title: 'Spoofed' }))
  await alice.collection('users').update(userA.id, { name: 'Alice Updated' })
  await alice.collection('organizations').update(orgA.id, { cif: 'TEST-CIF' })
  await assert.rejects(bob.collection('organizations').update(orgB.id, { name: 'Changed' }))
  const preferences = await alice.collection('user_preferences').create({ organization_id: orgA.id, user_id: userA.id, notifications: { email: true } })
  const updatedPreferences = await alice.collection('user_preferences').update(preferences.id, { notifications: { email: false, servers: true } })
  assert.equal(updatedPreferences.notifications.email, false)
  await assert.rejects(bob.collection('user_preferences').getOne(preferences.id))
  const integration = await alice.collection('integrations').create({ organization_id: orgA.id, name: 'Stripe', connected: true })
  assert.equal((await alice.collection('integrations').update(integration.id, { connected: false })).connected, false)

  const token = 'new-agent-token-123456789012345'
  const server = await alice.send('/api/orbit/servers', { method: 'POST', body: { organization_id: orgA.id, name: 'New VPS', agent_token: token, domains: [], services: [] } })
  assert.equal(server.agent_token_hash, undefined)
  assert.equal(server.status, 'offline')
  await assert.rejects(alice.collection('servers').create({ organization_id: orgA.id, name: 'Bypass' }))
  const reportMetric = (token, cpu, serverId = server.id) => fetch(`${url}/api/orbit/server-metrics`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ server_id: serverId, cpu, ram: 20, disk: 30, load: 1, latency: 2, uptime: '1 day' }) })
  assert.equal((await reportMetric('wrong-token', 10)).status, 401)
  assert.equal((await reportMetric(token, 101)).status, 400)
  const response = await reportMetric(token, 91)
  assert.equal(response.status, 200, (await response.clone().text()) + '\n' + logs)
  assert.equal((await alice.collection('servers').getOne(server.id)).status, 'critical')
  assert.equal((await reportMetric(token, 75)).status, 200)
  assert.equal((await alice.collection('servers').getOne(server.id)).status, 'warning')
  assert.equal((await alice.collection('server_metrics').getFullList()).length, 2)
  assert.equal((await bob.collection('server_metrics').getFullList()).length, 0)

  // Reproduce the production failure: login succeeds but an unassigned account
  // sees no credentials and its create request is rejected by the collection rule.
  const unassigned = await service.collection('users').create({ name: 'Unassigned', email: 'unassigned@example.com', password, passwordConfirm: password, role: 'user' })
  const unassignedClient = new PocketBase(url)
  await unassignedClient.collection('users').authWithPassword(unassigned.email, password)
  assert.equal((await unassignedClient.collection('credentials').getFullList()).length, 0)
  assert.throws(() => requireWorkspace(unassignedClient.authStore.record), { code: 'ORBIT_WORKSPACE' })
  await assert.rejects(unassignedClient.collection('credentials').create({ organization_id: '', created_by: unassigned.id, name: 'Rejected' }), (error) => error.status === 400)
  assert.throws(() => requireWorkspace(userA, []), { code: 'ORBIT_WORKSPACE' })

  const repair = (await readFile(join(root, 'scripts/fix-credentials-workspace.sql'), 'utf8'))
    .replaceAll('TU_EMAIL_ORBIT', unassigned.email)
  const restoredServer = await service.collection('servers').create({ organization_id: orgA.id, name: 'Restored VPS', status: 'offline', domains: [], services: [] })
  const database = new DatabaseSync(join(directory, 'data', 'data.db'))
  // Use a real bcrypt hash from this disposable test database to model an
  // imported agent token, without adding a crypto package or exposing hashes.
  database.prepare('UPDATE servers SET agent_token_hash = (SELECT password FROM users WHERE id = ?) WHERE id = ?').run(userA.id, restoredServer.id)
  // Multiple workspaces must require an explicit selection and change no account.
  assert.throws(() => database.prepare(repair).all(), /NOT NULL/)
  assert.equal(database.prepare('SELECT organization_id FROM users WHERE id = ?').get(unassigned.id).organization_id, '')
  const targetedRepair = repair.replace("VALUES ('unassigned@example.com', '')", `VALUES ('unassigned@example.com', '${orgA.id}')`)
  assert.equal(database.prepare(targetedRepair).all().length, 1)
  assert.equal(database.prepare('SELECT organization_id FROM users WHERE id = ?').get(userB.id).organization_id, orgB.id)
  database.close()
  assert.equal((await reportMetric('wrong-token', 10, restoredServer.id)).status, 401)
  const restoredReport = await reportMetric(password, 35, restoredServer.id)
  assert.equal(restoredReport.status, 200, await restoredReport.clone().text())
  assert.equal((await alice.collection('servers').getOne(restoredServer.id)).status, 'operational')

  await t.test('chart fetches only the latest 48 points for the selected server in one request', async () => {
    const fixtureServer = await service.collection('servers').create({ organization_id: orgA.id, name: 'History fixture' })
    const foreignServer = await service.collection('servers').create({ organization_id: orgB.id, name: 'Foreign history' })
    const fixtureDb = new DatabaseSync(join(directory, 'data', 'data.db'))
    const insert = fixtureDb.prepare('INSERT INTO server_metrics (id, organization_id, server_id, checked_at, cpu, ram, disk) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const ids = []
    const baseTime = Date.now() - 86400000
    try {
      fixtureDb.exec('BEGIN')
      for (let i = 0; i < 1200; i++) {
        const id = `metric${String(i).padStart(9, '0')}`
        ids.push(id)
        const date = new Date(baseTime + i * 30000).toISOString().replace('T', ' ')
        insert.run(id, orgA.id, fixtureServer.id, date, i % 100, 20, 30)
      }
      // More recent readings from other servers must not displace this chart.
      insert.run('othermetric0001', orgA.id, restoredServer.id, new Date().toISOString().replace('T', ' '), 99, 99, 99)
      insert.run('othermetric0002', orgB.id, foreignServer.id, new Date().toISOString().replace('T', ' '), 99, 99, 99)
      fixtureDb.exec('COMMIT')
    } finally {
      fixtureDb.close()
    }

    const requests = []
    alice.beforeSend = (url, options) => { requests.push(new URLSearchParams(options.query)); return { url, options } }
    try {
      assert.deepEqual(await fetchServerMetricHistory(alice, null), [])
      assert.equal(requests.length, 0)
      const history = await fetchServerMetricHistory(alice, fixtureServer.id)
      assert.equal(history.length, SERVER_METRIC_POINTS)
      assert.deepEqual(history.map((point) => point.id), ids.slice(-48))
      assert.ok(history.every((point) => point.serverId === fixtureServer.id && point.ram === 20 && point.disk === 30))
      assert.equal(history[0].cpu, 52)
      assert.ok(history.every((point, index) => !index || point.checkedAt > history[index - 1].checkedAt))
      assert.equal(requests.length, 1)
      const query = requests[0]
      assert.equal(query.get('page'), '1')
      assert.equal(query.get('perPage'), '48')
      assert.equal(query.get('skipTotal'), 'true')
      assert.equal(query.get('sort'), '-checked_at')
      assert.equal(query.get('fields'), 'id,server_id,checked_at,cpu,ram,disk')
      assert.ok(query.get('filter').includes(fixtureServer.id))
      assert.deepEqual(await fetchServerMetricHistory(alice, foreignServer.id), [])
      assert.deepEqual(await fetchServerMetricHistory(bob, fixtureServer.id), [])
      const shortHistory = await fetchServerMetricHistory(alice, restoredServer.id)
      assert.equal(shortHistory.length, 2)
      assert.ok(shortHistory.every((point) => point.serverId === restoredServer.id))
      const controller = new AbortController()
      controller.abort()
      await assert.rejects(fetchServerMetricHistory(alice, fixtureServer.id, { signal: controller.signal }), (error) => error.isAbort)
    } finally {
      alice.beforeSend = undefined
    }
  })

  const sharedCredential = await alice.collection('credentials').create({ organization_id: orgA.id, created_by: userA.id, name: 'Existing credential' })
  const refreshed = await unassignedClient.collection('users').authRefresh()
  assert.equal(requireWorkspace(refreshed.record, [orgA, orgB]), orgA.id)
  assert.ok((await unassignedClient.collection('credentials').getFullList()).some((credential) => credential.id === sharedCredential.id))
  await unassignedClient.collection('credentials').create({ organization_id: orgA.id, created_by: unassigned.id, name: 'New credential' })
  await assert.rejects(unassignedClient.collection('clients').getOne(clientB.id))
  alice.authStore.clear()
  assert.equal(alice.authStore.isValid, false)
})
