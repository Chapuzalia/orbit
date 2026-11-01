import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createAlteilServer } from '../mcp/core/server.mjs'
import { createTickitPosModule } from '../mcp/modules/tickit-pos/index.mjs'
import { TickitPosService, readTickitConfig, tickitError } from '../mcp/modules/tickit-pos/service.mjs'
import { billingBody, billingCommands } from '../mcp/modules/tickit-pos/billing-schema.mjs'
import { requestSchema as posRequestSchema } from './fixtures/tickit-billing-schemas.mjs'
import { configureVenueOperations } from '../mcp/modules/tickit-pos/venue-operations.mjs'
import { createSupabaseFixture, ids, serviceRoleKey, tickitEnv } from './helpers/tickit-supabase.mjs'

const email = 'billing-agent@example.com'
const password = 'Dedicated-agent-test-password'
const actor = randomUUID()
const versionId = randomUUID()
const selection = { planVersionId: versionId, addons: [] }
const quote = { tenant_id: ids.tenant, selection, exception: null, reason: 'Alta acordada', confirm: true }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

function setup(overrides = {}) {
  const fixture = createSupabaseFixture()
  fixture.rows('profiles').push({ id: actor, is_superadmin: true })
  const state = { auth: [], calls: [], tokens: [], operations: new Map(), accounts: new Map(), failure: null, invalidAuth: false }
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input)
    const headers = new Headers(options.headers)
    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse(options.body)
      state.auth.push(body)
      assert.equal(url.searchParams.get('grant_type'), 'password')
      assert.equal(body.email, email)
      assert.equal(body.password, password)
      assert.equal(headers.get('apikey'), serviceRoleKey)
      if (state.invalidAuth) return json({ error: 'invalid_grant', msg: `private ${password}` }, 400)
      const token = `test.${Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', exp: 9999999999 })).toString('base64url')}.${state.tokens.length}`
      state.tokens.push(token)
      return json({ access_token: token, refresh_token: `private-refresh-${state.tokens.length}`, expires_in: 3600, token_type: 'bearer', user: { id: actor, email } })
    }
    if (url.pathname === '/functions/v1/billing') {
      const body = JSON.parse(options.body)
      state.calls.push({ body, headers })
      assert.ok(state.tokens.some(token => headers.get('authorization') === `Bearer ${token}`))
      assert.equal(headers.get('apikey'), serviceRoleKey)
      if (state.failure) return state.failure(body)
      if (body.action === 'catalog') return json({ products: [{ key: 'base', kind: 'plan' }], versions: [{ id: versionId, published: true }], features: [] })
      if (body.action === 'quote') {
        const operation = { id: randomUUID(), tenant_id: body.tenantId, status: 'quoted', preview: { amountDueCents: 2500, recurringCents: 2500, currency: 'eur' }, contract: body.selection }
        state.operations.set(operation.id, operation)
        return json(operation)
      }
      if (body.action === 'confirm' || body.action === 'retry-operation') {
        const operation = state.operations.get(body.operationId)
        if (!operation || operation.tenant_id !== body.tenantId) return json({ error: 'Foreign operation' }, 409)
        operation.status = 'payment_pending'
        operation.result = { url: 'https://checkout.stripe.com/c/pay/test-session' }
        return json({ operation, url: operation.result.url })
      }
      if (body.action === 'get') return json({ account: state.accounts.get(body.tenantId) || null, operations: [...state.operations.values()].filter(op => op.tenant_id === body.tenantId) })
      return json({ ok: true, ...body })
    }
    return fixture.fetchImpl(input, options)
  }
  const service = new TickitPosService(readTickitConfig({ ...tickitEnv, TICKIT_POS_BILLING_EMAIL: email, TICKIT_POS_BILLING_PASSWORD: password, ...overrides }), { fetchImpl })
  return { ...fixture, service, billingState: state }
}

async function connect(service, t, readOnly = false) {
  const server = createAlteilServer({ modules: [createTickitPosModule(service)], readOnly })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'billing-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return client
}
const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name: `tickit_pos_${name}`, arguments: args })
  assert.ok(!result.isError, JSON.stringify(result))
  return result.structuredContent
}

test('billing is optional and configuration never exposes dedicated credentials', async () => {
  const fixture = setup({ TICKIT_POS_BILLING_EMAIL: '', TICKIT_POS_BILLING_PASSWORD: '' })
  assert.equal((await fixture.service.capabilities()).billing.configured, false)
  await assert.rejects(fixture.service.billing.execute('catalog', {}), error => error.code === 'BILLING_NOT_CONFIGURED')
  assert.equal(fixture.billingState.auth.length, 0)
  assert.throws(() => readTickitConfig({ ...tickitEnv, TICKIT_POS_BILLING_EMAIL: email }), /conjuntamente/)
  const { service } = setup()
  const capabilities = await service.capabilities()
  assert.equal(capabilities.billing.configured, true)
  assert.ok(capabilities.billing.commands.includes('quote'))
  assert.equal(capabilities.billing.stripe_mode, 'test')
  for (const secret of [email, password, serviceRoleKey]) assert.ok(!JSON.stringify(capabilities).includes(secret))
})

test('MCP discovers billing schemas, resource and company onboarding prompt', async (t) => {
  const { service } = setup()
  const client = await connect(service, t)
  const { tools } = await client.listTools()
  for (const [command, def] of Object.entries(billingCommands)) {
    const tool = tools.find(tool => tool.name === `tickit_pos_billing_${command}`)
    assert.ok(tool, command)
    assert.equal(tool.annotations.readOnlyHint, def.readOnly)
    assert.equal(tool.inputSchema.additionalProperties, false)
    if (!def.readOnly) assert.ok(tool.inputSchema.required.includes('confirm'))
  }
  const schema = tools.find(tool => tool.name === 'tickit_pos_billing_quote').inputSchema
  for (const field of ['tenant_id', 'selection', 'exception', 'reason', 'confirm']) assert.ok(schema.properties[field])
  assert.ok(schema.properties.selection.properties.planVersionId)
  const resource = await client.readResource({ uri: 'tickit-pos://capabilities' })
  assert.equal(JSON.parse(resource.contents[0].text).billing.configured, true)
  const prompts = await client.listPrompts()
  assert.ok(prompts.prompts.some(prompt => prompt.name === 'tickit_pos_company_onboarding'))
  const prompt = await client.getPrompt({ name: 'tickit_pos_company_onboarding' })
  assert.match(prompt.messages[0].content.text, /Checkout/)
})

test('agent can create a company, owner, terminal access and prepare/confirm its Stripe contract', async (t) => {
  const { service, billingState } = setup()
  const client = await connect(service, t)
  const tenant = await call(client, 'tenants_create', { data: { name: 'New business', slug: 'new-business', max_venues: 1, max_devices: 2 }, confirm: true })
  const owner = await call(client, 'users_create', { tenant_id: tenant.id, role: 'owner', email: 'new-owner@example.com', password: 'Owner-test-password', confirm: true })
  assert.equal(owner.memberships[0].tenant_id, tenant.id)
  const venue = await call(client, 'venues_create', { tenant_id: tenant.id, data: { name: 'Local', is_active: true }, confirm: true })
  const device = await call(client, 'devices_create', { venue_id: venue.id, data: { name: 'Checkout', device_mode: 'checkout', is_active: true }, confirm: true })
  const cashier = await call(client, 'users_create', { tenant_id: tenant.id, role: 'cashier', device_id: device.id, email: 'new-terminal@example.com', password: 'Terminal-test-password', confirm: true })
  assert.equal(cashier.device_assignments[0].device_id, device.id)
  const catalog = await call(client, 'billing_catalog')
  assert.equal(catalog.versions[0].id, versionId)
  await call(client, 'billing_settings', { tenant_id: tenant.id, legal_name: 'New business SL', tax_id: 'B00000000', email: 'invoices@example.com', grace_days: 7, reason: 'Alta', confirm: true })
  const operation = await call(client, 'billing_quote', { ...quote, tenant_id: tenant.id })
  assert.equal(operation.preview.amountDueCents, 2500)
  const result = await call(client, 'billing_confirm', { tenant_id: tenant.id, operation_id: operation.id, confirm: true })
  assert.equal(result.operation.status, 'payment_pending')
  assert.match(result.url, /^https:\/\/checkout.stripe.com\//)
  assert.equal(billingState.accounts.has(tenant.id), false, 'Checkout creation must not project active rights')
  // Simulate the trusted POS webhook projection after customer payment.
  billingState.accounts.set(tenant.id, { tenant_id: tenant.id, status: 'active', source: 'stripe', contract: selection })
  await call(client, 'billing_reconcile', { tenant_id: tenant.id, confirm: true })
  assert.equal((await call(client, 'billing_get', { tenant_id: tenant.id, confirm: true })).account.status, 'active')
  assert.ok(billingState.calls.every(call => !('confirm' in call.body)))
})

test('all billing commands forward only their POS contract fields', async () => {
  const op = randomUUID()
  assert.deepEqual(billingBody('confirm', { tenant_id: ids.tenant, operation_id: op, confirm: true }), { action: 'confirm', tenantId: ids.tenant, operationId: op })
  assert.deepEqual(billingBody('catalog_publish', { version_id: versionId, confirm: true }), { action: 'catalog-publish', versionId })
  assert.deepEqual(billingBody('retry_event', { event_id: 'evt_test', confirm: true }), { action: 'retry-event', eventId: 'evt_test' })
  assert.deepEqual(billingBody('settings', { tenant_id: ids.tenant, grace_days: 7, legal_name: 'Name', tax_id: '', email: '', reason: 'Setup', confirm: true }),
    { action: 'settings', tenantId: ids.tenant, graceDays: 7, legalName: 'Name', taxId: '', email: '', reason: 'Setup' })
  const { service, billingState } = setup()
  const exception = { freeUnits: {}, limits: {}, discountBasisPoints: 0, customAmounts: {}, cycles: null, reason: 'Trial addon', promotions: [{ id: op, key: 'restaurant', freeUnits: 1, start: 'immediate', durationUnit: 'months', duration: 3, consent: 'Acuerdo comercial' }] }
  await service.billing.execute('quote', { ...quote, exception })
  assert.deepEqual(billingState.calls[0].body.exception, exception)
})

test('every generated billing request passes the current POS request validator snapshot', () => {
  const product = { key: 'base', kind: 'plan', name: 'Plan', description: '', scope: 'tenant', featureKey: null, resource: null, active: true, sortOrder: 0 }
  const version = { interval: 'month', amountCents: 2500, features: ['restaurant'], limits: { venues: 1, devices: 2 }, included: {}, maximum: null, requires: [] }
  const cases = {
    catalog: {}, overview: {}, get: { tenant_id: ids.tenant, confirm: true },
    catalog_save: { product, version, reason: 'Tarifa acordada', confirm: true },
    catalog_publish: { version_id: versionId, confirm: true },
    quote, quote_cancel: { tenant_id: ids.tenant, immediate: false, reason: 'Cancelación acordada', confirm: true },
    confirm: { tenant_id: ids.tenant, operation_id: randomUUID(), confirm: true },
    portal: { tenant_id: ids.tenant, confirm: true },
    settings: { tenant_id: ids.tenant, grace_days: 7, legal_name: '', tax_id: '', email: '', reason: 'Alta', confirm: true },
    reconcile: { tenant_id: ids.tenant, confirm: true }, reconcile_batch: { confirm: true },
    retry_operation: { tenant_id: ids.tenant, operation_id: randomUUID(), confirm: true }, retry_event: { event_id: 'evt_test', confirm: true },
  }
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(billingCommands).sort())
  for (const [command, input] of Object.entries(cases)) {
    const body = billingBody(command, input)
    assert.deepEqual(posRequestSchema.parse(body), body, command)
  }
  const promotional = billingBody('quote', { ...quote, selection: { ...selection, addons: [{ key: 'restaurant', versionId: randomUUID(), quantity: 1, venueIds: [ids.venue], deviceIds: [] }] },
    exception: { freeUnits: { restaurant: 1 }, limits: { devices: 4 }, discountBasisPoints: 1000, customAmounts: {}, cycles: null, reason: 'Condición comercial',
      promotions: [{ id: randomUUID(), key: 'restaurant', freeUnits: 1, start: 'period_end', durationUnit: 'cycles', duration: 2, consent: 'Consentimiento registrado' }] } })
  assert.deepEqual(posRequestSchema.parse(promotional), promotional)
})

test('strict validation and confirmation reject arbitrary prices, actions and malformed scopes before I/O', async () => {
  const { service, billingState } = setup()
  for (const input of [
    { ...quote, confirm: false }, { ...quote, confirm: undefined }, { ...quote, tenant_id: 'invalid' },
    { ...quote, action: 'confirm' }, { ...quote, actorId: actor },
    { ...quote, selection: { ...selection, amountCents: 1 } },
    { ...quote, selection: { ...selection, addons: [{ key: 'restaurant', versionId, quantity: -1, venueIds: [], deviceIds: [] }] } },
  ]) await assert.rejects(service.billing.execute('quote', input))
  assert.equal(billingState.auth.length, 0)
  assert.equal(billingState.calls.length, 0)
})

test('missing/non-superadmin account and missing tenant cannot reach billing', async () => {
  const { service, billingState, rows } = setup()
  billingState.invalidAuth = true
  await assert.rejects(service.billing.execute('catalog', {}), error => error.code === 'BILLING_AUTH_FAILED' && !JSON.stringify(tickitError(error)).includes(password))
  billingState.invalidAuth = false
  rows('profiles')[0].is_superadmin = false
  await assert.rejects(service.billing.execute('catalog', {}), error => error.code === 'BILLING_FORBIDDEN')
  rows('profiles')[0].is_superadmin = true
  await assert.rejects(service.billing.execute('get', { tenant_id: randomUUID(), confirm: true }), error => error.code === 'TENANT_UNAVAILABLE')
  assert.equal(billingState.calls.length, 0)
})

test('concurrent billing requests keep JWTs isolated and CRUD retains service authority', async () => {
  const { service, billingState } = setup()
  await Promise.all([service.billing.execute('quote', quote), service.billing.execute('quote', { ...quote, tenant_id: ids.otherTenant })])
  assert.equal(billingState.auth.length, 2)
  assert.equal(new Set(billingState.calls.map(call => call.headers.get('authorization'))).size, 2)
  assert.deepEqual(billingState.calls.map(call => call.body.tenantId).sort(), [ids.tenant, ids.otherTenant].sort())
  assert.equal((await service.execute('tenants', 'list', {})).items.length, 2)
})

test('global and module read-only hide/block every billing mutation including lazy account creation', async (t) => {
  for (const global of [false, true]) {
    const { service, billingState } = setup({ TICKIT_POS_READ_ONLY: global ? 'false' : 'true' })
    const client = await connect(service, t, global)
    const { tools } = await client.listTools()
    const names = tools.filter(tool => tool.name.startsWith('tickit_pos_billing_')).map(tool => tool.name)
    assert.deepEqual(names.sort(), ['tickit_pos_billing_catalog', 'tickit_pos_billing_overview'])
    await assert.rejects(service.billing.execute('quote', quote), error => error.code === 'READ_ONLY')
    await assert.rejects(service.billing.execute('get', { tenant_id: ids.tenant, confirm: true }), error => error.code === 'READ_ONLY')
    assert.equal(billingState.auth.length, 0)
    await call(client, 'billing_catalog')
    assert.deepEqual(service.billing.capabilities().commands.sort(), ['catalog', 'overview'])
  }
})

test('lost/failed billing responses do not retry and preserve the original operation ID for recovery', async () => {
  for (const fail of ['network', 409, 500, 'invalid', 'oversized']) {
    const { service, billingState } = setup()
    const operation = await service.billing.execute('quote', quote)
    const input = { tenant_id: ids.tenant, operation_id: operation.id, confirm: true }
    billingState.failure = () => {
      if (fail === 'network') throw new TypeError(`private ${password}`)
      if (fail === 'invalid') return new Response('not json', { status: 200 })
      if (fail === 'oversized') return new Response('too big', { headers: { 'content-length': String(5 * 1024 * 1024) } })
      return json({ error: `private ${password} ${serviceRoleKey}` }, fail)
    }
    await assert.rejects(service.billing.execute('confirm', input), error => {
      const result = tickitError(error)
      assert.equal(result.outcome_unknown, true)
      assert.equal(result.operation_id, operation.id)
      assert.equal(result.tenant_id, ids.tenant)
      assert.ok(!JSON.stringify(result).includes(password))
      assert.ok(!JSON.stringify(result).includes(serviceRoleKey))
      return true
    })
    assert.equal(billingState.calls.filter(call => call.body.action === 'confirm').length, 1)
    billingState.failure = null
    const recovered = await service.billing.execute('retry_operation', input)
    assert.equal(recovered.operation.id, operation.id)
    assert.equal(billingState.operations.size, 1)
  }
})

test('foreign operation is rejected by POS without changing either tenant', async () => {
  const { service, billingState } = setup()
  const operation = await service.billing.execute('quote', quote)
  await assert.rejects(service.billing.execute('confirm', { tenant_id: ids.otherTenant, operation_id: operation.id, confirm: true }))
  assert.equal(billingState.operations.get(operation.id).status, 'quoted')
})

test('responses redact service credentials and Auth session material even in nested strings', async () => {
  const { service, billingState } = setup()
  billingState.failure = () => json({ url: 'https://checkout.stripe.com/c/pay/test', access_token: billingState.tokens.at(-1), nested: {
    password, refresh_token: 'private-refresh-1', description: `${serviceRoleKey} ${email} ${password} ${billingState.tokens.at(-1)} private-refresh-1`,
  } })
  const result = await service.billing.execute('catalog', {})
  assert.equal(result.url, 'https://checkout.stripe.com/c/pay/test')
  assert.equal(result.access_token, undefined)
  assert.equal(result.nested.password, undefined)
  for (const secret of [serviceRoleKey, email, password, ...billingState.tokens, 'private-refresh-1']) assert.ok(!JSON.stringify(result).includes(secret))
})

function venueSetup() {
  const fixture = createSupabaseFixture()
  const allowed = new Set()
  const checks = []
  const service = new TickitPosService(readTickitConfig(tickitEnv), { fetchImpl: async (url, options) => {
    if (new URL(url).pathname.endsWith('/rpc/venue_addon_enabled')) {
      const body = JSON.parse(options.body)
      checks.push(body)
      return json(allowed.has(`${body.p_tenant_id}:${body.p_venue_id}:${body.p_addon_key}`))
    }
    return fixture.fetchImpl(url, options)
  } })
  return { ...fixture, service, allowed, checks }
}

test('venue operation switches require the actual tenant/venue entitlement and preserve commercial assignments', async (t) => {
  const { service, allowed, rows, checks, state } = venueSetup()
  const client = await connect(service, t)
  const input = { venue_id: ids.venue, data: { production_enabled: true, inventory_enabled: true }, confirm: true }
  await assert.rejects(configureVenueOperations(service, input), error => error.code === 'VENUE_ADDON_NOT_CONTRACTED')
  assert.equal(state.requests.filter(request => request.method === 'PATCH').length, 0)
  for (const addon of ['restaurant', 'production', 'inventory']) allowed.add(`${ids.tenant}:${ids.venue}:${addon}`)
  const venue = await call(client, 'venue_operations_configure', input)
  assert.equal(venue.tables_enabled, true)
  assert.equal(venue.production_enabled, true)
  assert.equal(venue.inventory_enabled, true)
  assert.ok(checks.every(check => check.p_tenant_id === ids.tenant && check.p_venue_id === ids.venue))
  await assert.rejects(configureVenueOperations(service, { ...input, venue_id: ids.otherVenue }), error => error.code === 'VENUE_ADDON_NOT_CONTRACTED')
  assert.equal(rows('venues').find(row => row.id === ids.otherVenue).production_enabled, undefined)
  assert.ok(!state.requests.some(request => request.method !== 'GET' && /tenant_feature_assignments|venue_addon_assignments|billing_accounts/.test(request.path)))
})

test('venue switch shutdown preserves open and carried work, and enforces operational dependencies', async () => {
  const { service, rows } = venueSetup()
  const venue = rows('venues').find(row => row.id === ids.venue)
  Object.assign(venue, { tables_enabled: true, production_enabled: true, inventory_enabled: true })
  const input = { venue_id: ids.venue, data: { tables_enabled: false }, confirm: true }
  rows('cash_sessions').push({ id: randomUUID(), tenant_id: ids.tenant, venue_id: ids.venue, status: 'open' })
  await assert.rejects(configureVenueOperations(service, input), error => error.code === 'OPEN_WORK')
  rows('cash_sessions').length = 0
  for (const status of ['open', 'carried_forward']) {
    rows('orders').push({ id: randomUUID(), tenant_id: ids.tenant, venue_id: ids.venue, status })
    await assert.rejects(configureVenueOperations(service, input), error => error.code === 'OPEN_WORK')
    rows('orders').length = 0
  }
  assert.equal(venue.tables_enabled, true)
  await assert.rejects(configureVenueOperations(service, { ...input, data: { tables_enabled: false, production_enabled: true } }), error => error.code === 'VENUE_OPERATIONS_CONFLICT')
  const updated = await configureVenueOperations(service, input)
  assert.equal(updated.tables_enabled, false)
  assert.equal(updated.production_enabled, false)
  assert.equal(updated.inventory_enabled, true)
})

test('venue switches reject invalid fields and read-only before network and never retry uncertain changes', async () => {
  const { service, state } = venueSetup()
  for (const data of [{}, { max_devices: 100 }, { tickit_assist_enabled: true }]) await assert.rejects(configureVenueOperations(service, { venue_id: ids.venue, data, confirm: true }))
  await assert.rejects(configureVenueOperations(service, { venue_id: ids.venue, data: { tables_enabled: false } }))
  assert.equal(state.requests.length, 0)
  service.config.readOnly = true
  await assert.rejects(configureVenueOperations(service, { venue_id: ids.venue, data: { tables_enabled: false }, confirm: true }), error => error.code === 'READ_ONLY')
  assert.equal(state.requests.length, 0)
  service.config.readOnly = false
  state.dropAfter = request => request.method === 'PATCH'
  await assert.rejects(configureVenueOperations(service, { venue_id: ids.venue, data: { tables_enabled: false }, confirm: true }), error => error.details?.outcome_unknown && error.details.venue_id === ids.venue)
  assert.equal(state.requests.filter(request => request.method === 'PATCH').length, 1)
})
