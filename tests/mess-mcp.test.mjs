import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import PocketBase from 'pocketbase'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createAlteilServer } from '../mcp/core/server.mjs'
import { loadModules } from '../mcp/core/registry.mjs'
import { readCoreConfig } from '../mcp/core/config.mjs'
import { createMessModule } from '../mcp/modules/mess/index.mjs'
import { MessService, readMessConfig, messError } from '../mcp/modules/mess/service.mjs'
import { date, reservationCreate, listInput } from '../mcp/modules/mess/schema.mjs'
import { createOrbitModule } from '../mcp/modules/orbit/index.mjs'
import { createTickitPosModule } from '../mcp/modules/tickit-pos/index.mjs'
import { TickitPosService, readTickitConfig } from '../mcp/modules/tickit-pos/service.mjs'
import { createSupabaseFixture, tickitEnv } from './helpers/tickit-supabase.mjs'
import { startMessPocketBase } from './helpers/mess-pocketbase.mjs'

const env = { ALTEIL_MODULES: 'mess', MESS_POCKETBASE_URL: 'http://127.0.0.1:8090', MESS_USER_TOKEN: 'test-token' }
const reservation = (overrides = {}) => ({ reservation_date: '2032-02-29', start_time: '20:30', concept: 'Birthday', contact_person: 'Ana', contact_phone: '+34 612345678', waiter_id: 'Camarero A', needs_dj: true, deposit_paid: false, ...overrides })
async function connect(modules, t, options = {}) {
  const server = createAlteilServer({ modules, ...options })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'mess-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport); await client.connect(clientTransport)
  return client
}
const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name, arguments: args })
  assert.ok(!result.isError, JSON.stringify(result))
  return result.structuredContent
}

test('MESS config and input contracts validate dates, time, credentials and strict fields', async () => {
  assert.throws(() => readMessConfig({}), /MESS_POCKETBASE_URL/)
  assert.throws(() => readMessConfig({ ...env, MESS_POCKETBASE_URL: 'http://remote.example.com' }), /HTTPS/)
  assert.throws(() => readMessConfig({ ...env, MESS_POCKETBASE_URL: 'https://example.com/api' }), /sin rutas/)
  assert.throws(() => readMessConfig({ ...env, MESS_USER_TOKEN: '' }), /MESS_USER_TOKEN/)
  assert.throws(() => readMessConfig({ ...env, MESS_AUTH_COLLECTION: 'customers' }), /users/)
  assert.throws(() => readMessConfig({ ...env, MESS_READ_ONLY: 'yes' }), /true o false/)
  assert.ok(date.safeParse('2032-02-29').success)
  assert.ok(!date.safeParse('2031-02-29').success)
  assert.ok(!date.safeParse('2032-04-31').success)
  assert.ok(!reservationCreate.safeParse({ data: reservation({ user_id: 'intruder' }), confirm: true }).success)
  assert.ok(!reservationCreate.safeParse({ data: reservation({ start_time: '25:00' }), confirm: true }).success)
  assert.ok(!listInput.safeParse({ from: '2032-03-01', to: '2032-02-29' }).success)
  const modules = await loadModules(readCoreConfig(env), env)
  assert.deepEqual(modules.map((module) => module.id), ['mess'])
})

test('MESS alone negotiates stdio and exposes its catalog without network authentication', { timeout: 15000 }, async (t) => {
  const client = new Client({ name: 'mess-stdio', version: '1.0.0' })
  t.after(() => client.close())
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('mcp/index.mjs')], env: { PATH: process.env.PATH || process.env.Path || '', ...env }, stderr: 'pipe' }))
  const { tools } = await client.listTools()
  assert.equal(tools.filter((tool) => tool.name.startsWith('mess_')).length, 9)
  assert.ok(!tools.some((tool) => tool.name.startsWith('orbit_') || tool.name.startsWith('tickit_pos_')))
  assert.equal((await call(client, 'alteil_modules')).modules[0].scope, 'venue_reservations')
  assert.equal((await client.readResource({ uri: 'mess://capabilities' })).contents.length, 1)
})

test('MESS MCP uses actual PocketBase schema and hooks for the reservations calendar', { timeout: 90000 }, async (t) => {
  const local = await startMessPocketBase(t)
  const service = new MessService(readMessConfig(local.env))
  const client = await connect([createMessModule(service)], t)

  await t.test('MCP CRUD reprograms reservations and preserves untouched operational fields', async () => {
    assert.equal((await call(client, 'mess_whoami')).user.id, local.user.id)
    const created = await call(client, 'mess_reservations_create', { data: reservation(), confirm: true })
    assert.equal(created.reservation_date, '2032-02-29')
    assert.equal(created.waiter_id, 'Camarero A')
    assert.equal(created.contact_phone, '+34 612345678')
    assert.ok(!Object.hasOwn(created, 'collectionId'))
    const updated = await call(client, 'mess_reservations_update', { id: created.id, data: { reservation_date: '2032-03-01', start_time: '01:30', deposit_paid: true }, confirm: true })
    assert.equal(updated.needs_dj, true)
    assert.equal(updated.contact_person, 'Ana')
    assert.equal(updated.deposit_paid, true)
    assert.equal((await call(client, 'mess_reservations_list', { from: '2032-02-01', to: '2032-02-29' })).total_items, 0)
    assert.equal((await call(client, 'mess_reservations_get', { id: created.id })).start_time, '01:30')
    await call(client, 'mess_reservations_delete', { id: created.id, confirm: true })
    assert.equal((await client.callTool({ name: 'mess_reservations_get', arguments: { id: created.id } })).isError, true)
  })

  await t.test('calendar reads every page, preserves leap day, counts DJ/deposits and excludes other months', async () => {
    const saved = []
    for (let start = 0; start < 103; start += 10) {
      saved.push(...await Promise.all(Array.from({ length: Math.min(10, 103 - start) }, (_, offset) => local.admin.collection('venue_reservations').create(reservation({ concept: `Reservation ${start + offset}`, needs_dj: (start + offset) % 2 === 0, deposit_paid: (start + offset) % 2 === 1 })))))
    }
    const outside = await local.admin.collection('venue_reservations').create(reservation({ reservation_date: '2032-03-01' }))
    const calendar = await call(client, 'mess_calendar_get', { month: '2032-02' })
    assert.equal(calendar.days.length, 29)
    assert.equal(calendar.from, '2032-02-01')
    assert.equal(calendar.to, '2032-02-29')
    assert.equal(calendar.total_reservations, 103)
    assert.equal(calendar.days[28].count, 103)
    assert.equal(calendar.occupied_days, 1)
    assert.equal(calendar.deposit_pending, 52)
    assert.equal(calendar.needs_dj, 52)
    const filtered = await call(client, 'mess_reservations_list', { from: '2032-02-29', to: '2032-02-29', deposit_paid: true, per_page: 10 })
    assert.equal(filtered.total_items, 51)
    assert.equal(filtered.has_more, true)
    assert.equal(filtered.items.length, 10)
    for (const row of [...saved, outside]) await local.admin.collection('venue_reservations').delete(row.id)
  })

  await t.test('search escapes filter injection and supports quoted contact data', async () => {
    const created = await service.create({ data: reservation({ contact_person: 'Ana "test"', concept: 'Private booking' }), confirm: true })
    assert.equal((await service.list({ search: 'Ana "test"' })).items[0].id, created.id)
    assert.equal((await service.list({ search: '" || id != "' })).items.length, 0)
    const invalid = await client.callTool({ name: 'mess_reservations_update', arguments: { id: created.id, data: { created: '2030-01-01' }, confirm: true } })
    assert.equal(invalid.isError, true)
    await service.delete({ id: created.id, confirm: true })
  })

  await t.test('availability reuses the whole-day hook and permits multiple operational bookings', async () => {
    assert.equal((await service.availability({ date: '2020-01-01' })).available, false)
    assert.equal((await service.availability({ date: '2099-12-30' })).available, true)
    const first = await service.create({ data: reservation({ reservation_date: '2099-12-30' }), confirm: true })
    assert.equal((await service.availability({ date: '2099-12-30' })).available, false)
    const second = await service.create({ data: reservation({ reservation_date: '2099-12-30', start_time: '22:00' }), confirm: true })
    assert.equal((await service.list({ from: '2099-12-30', to: '2099-12-30' })).total_items, 2)
    await service.delete({ id: first.id, confirm: true }); await service.delete({ id: second.id, confirm: true })
    assert.equal((await service.availability({ date: '2099-12-30' })).available, true)
  })

  await t.test('staff, user tokens, superuser passwords and nonrenewable service tokens work', async () => {
    const staff = new MessService(readMessConfig({ ...local.env, MESS_USER_EMAIL: local.staff.email }))
    const staffPb = await staff.connect()
    assert.equal((await staff.identity()).user.role, 'user')
    const token = new MessService(readMessConfig({ ...local.env, MESS_USER_TOKEN: staffPb.authStore.token }))
    assert.equal((await token.identity()).user.id, local.staff.id)
    const root = new MessService(readMessConfig({ ...local.env, MESS_AUTH_COLLECTION: '_superusers', MESS_USER_EMAIL: 'mess-admin@example.com', MESS_USER_PASSWORD: 'Local-mess-password-123' }))
    assert.equal((await root.identity()).auth_collection, '_superusers')
    const rootToken = await local.admin.collection('_superusers').impersonate(local.admin.authStore.record.id, 3600)
    const impersonated = new MessService(readMessConfig({ ...local.env, MESS_AUTH_COLLECTION: '_superusers', MESS_USER_TOKEN: rootToken.authStore.token }))
    assert.equal((await impersonated.identity()).connected, true)
    const wrong = new MessService(readMessConfig({ ...local.env, MESS_AUTH_COLLECTION: '_superusers', MESS_USER_TOKEN: staffPb.authStore.token }))
    await assert.rejects(wrong.identity(), (error) => error.status === 403)
  })

  await t.test('invalid inputs, missing confirmations and read-only block writes before authentication', async () => {
    let requests = 0
    const guarded = new MessService(readMessConfig({ ...local.env, MESS_READ_ONLY: 'true' }), { fetchImpl: async () => { requests++; throw new Error('Not expected') } })
    await assert.rejects(guarded.create({ data: reservation(), confirm: true }), /solo lectura/)
    guarded.config.readOnly = false
    await assert.rejects(guarded.create({ data: reservation(), confirm: false }), /confirm/)
    await assert.rejects(guarded.create({ data: reservation({ reservation_date: '2031-02-29' }), confirm: true }))
    assert.equal(requests, 0)
    const readOnly = await connect([createMessModule(new MessService(readMessConfig(local.env)))], t, { readOnly: true })
    assert.ok((await readOnly.listTools()).tools.every((tool) => tool.annotations.readOnlyHint))
    const write = await readOnly.callTool({ name: 'mess_reservations_create', arguments: { data: reservation(), confirm: true } })
    assert.equal(write.isError, true)
    service.config.readOnly = true
    const denied = await client.callTool({ name: 'mess_reservations_create', arguments: { data: reservation(), confirm: true } })
    assert.equal(denied.structuredContent.error.code, 'READ_ONLY')
    service.config.readOnly = false
  })

  await t.test('lost response after a committed create returns the ID without retrying or duplicating', async () => {
    let writes = 0, requestedId
    const uncertain = new MessService(readMessConfig(local.env), { fetchImpl: async (url, options) => {
      const response = await fetch(url, options)
      if (new URL(url).pathname === '/api/collections/venue_reservations/records' && options.method === 'POST') {
        writes++; requestedId = JSON.parse(options.body).id
        await response.arrayBuffer()
        throw new TypeError('lost response with private-server-details')
      }
      return response
    } })
    await assert.rejects(uncertain.create({ data: reservation(), confirm: true }), (error) => {
      assert.equal(messError(error).outcome_unknown, true)
      assert.equal(messError(error).requested_id, requestedId)
      assert.ok(!JSON.stringify(messError(error)).includes('private-server-details'))
      return true
    })
    assert.equal(writes, 1)
    assert.equal((await local.admin.collection('venue_reservations').getOne(requestedId)).concept, 'Birthday')
    await service.delete({ id: requestedId, confirm: true })
  })

  await t.test('Orbit, Tickit and MESS coexist and backend errors stay inside their module', async () => {
    const tickit = new TickitPosService(readTickitConfig(tickitEnv), createSupabaseFixture())
    const orbit = createOrbitModule({ config: { readOnly: false, allowSecrets: false }, identity: async () => ({ organization: { id: 'orbit-workspace' } }) })
    const mixed = await connect([orbit, createTickitPosModule(tickit), createMessModule(service)], t)
    assert.deepEqual((await call(mixed, 'alteil_modules')).modules.map((module) => module.id), ['orbit', 'tickit_pos', 'mess'])
    assert.equal((await call(mixed, 'alteil_module_health', { module: 'mess' })).connected, true)
    assert.equal((await call(mixed, 'tickit_pos_capabilities')).access, 'platform_superadmin')
    assert.equal((await call(mixed, 'orbit_whoami')).organization.id, 'orbit-workspace')
    const bad = new MessService(readMessConfig({ ...local.env, MESS_USER_PASSWORD: 'Wrong-password' }))
    await assert.rejects(bad.identity())
    assert.ok(!JSON.stringify(messError({ status: 400, message: 'private', response: { password: 'secret' } })).includes('secret'))
    assert.equal(new PocketBase(local.url).authStore.token, '')
  })
})
