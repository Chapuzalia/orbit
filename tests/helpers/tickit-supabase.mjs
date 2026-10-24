import { randomUUID } from 'node:crypto'

export const ids = { tenant: '10000000-0000-4000-8000-000000000001', venue: '10000000-0000-4000-8000-000000000002', otherTenant: '10000000-0000-4000-8000-000000000003', otherVenue: '10000000-0000-4000-8000-000000000004', product: '10000000-0000-4000-8000-000000000005', format: '10000000-0000-4000-8000-000000000006', device: '10000000-0000-4000-8000-000000000007' }
export const serviceRoleKey = `test.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.test-signature`
export const tickitEnv = { ALTEIL_MODULES: 'tickit_pos', TICKIT_POS_SUPABASE_URL: 'http://127.0.0.1:8099', TICKIT_POS_SERVICE_ROLE_KEY: serviceRoleKey }

export function createSupabaseFixture() {
  const tables = new Map(Object.entries({
    tenants: [{ id: ids.tenant, name: 'Staging', slug: 'staging', is_active: true }, { id: ids.otherTenant, name: 'Other', is_active: true }],
    venues: [{ id: ids.venue, tenant_id: ids.tenant, name: 'Local staging', is_active: true }, { id: ids.otherVenue, tenant_id: ids.otherTenant, name: 'Other local', is_active: true }],
    products: [{ id: ids.product, tenant_id: ids.tenant, venue_id: ids.venue, name: 'Existing product', is_active: true }],
    catalog_sale_formats: [{ id: ids.format, tenant_id: ids.tenant, venue_id: ids.venue, name: 'Unidad', is_active: true }],
    devices: [{ id: ids.device, tenant_id: ids.tenant, venue_id: ids.venue, name: 'Terminal', device_mode: 'checkout', is_active: true, active_cash_session_id: null }],
  }))
  const state = { tables, users: new Map(), requests: [], fail: null, dropAfter: null }
  const rows = (table) => { if (!tables.has(table)) tables.set(table, []); return tables.get(table) }
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input)
    const method = options.method || 'GET'
    const headers = new Headers(options.headers)
    const body = options.body ? JSON.parse(options.body) : undefined
    const request = { path: url.pathname, params: url.searchParams, method, headers, body }
    state.requests.push(request)
    if (headers.get('apikey') !== serviceRoleKey || headers.get('authorization') !== `Bearer ${serviceRoleKey}`) return json({ code: 'invalid_key', message: serviceRoleKey }, 401)
    if (state.fail?.(request)) return json({ code: 'test_failure', message: `private ${serviceRoleKey}` }, 500)
    if (url.pathname.startsWith('/auth/v1/admin/users')) {
      const userId = url.pathname.split('/')[5]
      if (method === 'GET' && !userId) {
        const start = (Number(url.searchParams.get('page') || 1) - 1) * Number(url.searchParams.get('per_page') || 50)
        const response = json({ users: [...state.users.values()].slice(start, start + Number(url.searchParams.get('per_page') || 50)), aud: 'authenticated' })
        response.headers.set('x-total-count', String(state.users.size))
        response.headers.set('link', `<http://localhost?page=${Math.max(1, Math.ceil(state.users.size / Number(url.searchParams.get('per_page') || 50)))}>; rel="last"`)
        return response
      }
      if (method === 'POST') {
        if ([...state.users.values()].some((user) => user.email === body.email)) return json({ code: 'email_exists', msg: 'Already registered' }, 422)
        const user = { id: randomUUID(), email: body.email, email_confirmed_at: body.email_confirm ? '2026-10-24T00:00:00Z' : null,
          banned_until: body.ban_duration ? '2126-10-24T00:00:00Z' : null }
        state.users.set(user.id, user)
        return json({ user })
      }
      const user = state.users.get(userId)
      if (!user) return json({ code: 'user_not_found', msg: 'Unknown user' }, 404)
      if (method === 'PUT') {
        if (body.email) user.email = body.email
        if (body.email_confirm) user.email_confirmed_at = '2026-10-24T00:00:00Z'
        if (body.ban_duration === 'none') user.banned_until = null
        else if (body.ban_duration) user.banned_until = '2126-10-24T00:00:00Z'
      }
      if (method === 'DELETE') {
        state.users.delete(userId)
        for (const table of ['profiles', 'tenant_memberships', 'manager_venue_assignments', 'device_user_assignments']) tables.set(table, rows(table).filter((row) => row.id !== userId && row.user_id !== userId && row.manager_user_id !== userId))
      }
      return json({ user })
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').at(-1)
      if (rpc === 'update_platform_tenant_config') {
        const tenant = rows('tenants').find((row) => row.id === body.p_tenant_id)
        Object.assign(tenant, { name: body.p_name, slug: body.p_slug, max_venues: body.p_max_venues, max_devices: body.p_max_devices })
        return json([tenant])
      }
      if (rpc === 'get_catalog') {
        const venue = rows('venues').find((row) => row.id === body.p_venue_id)
        return json({ tenant_id: venue.tenant_id, venue_id: venue.id, products: rows('products').filter((row) => row.venue_id === venue.id), variants: rows('product_variants').filter((row) => row.venue_id === venue.id) })
      }
      if (rpc === 'set_manager_venue_assignments') {
        tables.set('manager_venue_assignments', rows('manager_venue_assignments').filter((row) => row.tenant_id !== body.p_tenant_id || row.manager_user_id !== body.p_manager_user_id))
        for (const id of body.p_venue_ids) rows('manager_venue_assignments').push({ tenant_id: body.p_tenant_id, manager_user_id: body.p_manager_user_id, venue_id: id })
        return json(body.p_venue_ids)
      }
      if (rpc === 'catalog_command' || rpc === 'catalog_command_batch_with_formats') {
        const payload = body.p_payload || body.p_commands[0].payload
        const command = body.p_command || body.p_commands[0].command
        const tenant = rows('venues').find((row) => row.id === body.p_venue_id).tenant_id
        let id = payload.id || randomUUID()
        if (command === 'create_product') {
          if (rows('products').some((row) => row.id === id)) return json({ code: '23505', message: 'Duplicate' }, 409)
          rows('products').push({ id, name: payload.name, tenant_id: tenant, venue_id: body.p_venue_id, product_type: payload.type, is_active: true })
          for (const variant of payload.variants) rows('product_variants').push({ id: variant.id || randomUUID(), product_id: id, tenant_id: tenant, venue_id: body.p_venue_id, name: variant.name, price_cents: variant.priceCents })
        }
        if (command === 'update_product') Object.assign(rows('products').find((row) => row.id === id), { name: payload.name })
        if (command === 'delete_product') tables.set('products', rows('products').filter((row) => row.id !== id))
        if (state.dropAfter?.(request)) throw new TypeError('fetch failed')
        return json({ result: 'SUCCESS', id })
      }
      return json({ result: 'SUCCESS' })
    }
    const table = url.pathname.split('/').at(-1)
    const matches = (row) => [...url.searchParams].every(([field, expression]) => {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(field)) return true
      const dot = expression.indexOf('.')
      const operator = expression.slice(0, dot)
      const value = expression.slice(dot + 1)
      if (operator === 'eq') return String(row[field]) === value
      if (operator === 'neq') return String(row[field]) !== value
      if (operator === 'ilike') return String(row[field] || '').toLowerCase().includes(value.replaceAll('%', '').toLowerCase())
      return true
    })
    let selected = rows(table).filter(matches)
    if (method === 'POST') {
      selected = []
      for (const item of Array.isArray(body) ? body : [body]) {
        const conflict = (url.searchParams.get('on_conflict') || 'id').split(',')
        const existing = rows(table).find((row) => conflict.every((key) => item[key] !== undefined && row[key] === item[key]))
        if (existing && headers.get('Prefer')?.includes('merge-duplicates')) { Object.assign(existing, item); selected.push(existing) }
        else { const row = { id: item.id || randomUUID(), ...item }; rows(table).push(row); selected.push(row) }
      }
    }
    if (method === 'PATCH') for (const row of selected) Object.assign(row, body)
    if (method === 'DELETE') tables.set(table, rows(table).filter((row) => !matches(row)))
    if (state.dropAfter?.(request)) throw new TypeError('fetch failed')
    const columns = url.searchParams.get('select')?.split(',')
    const start = Number(url.searchParams.get('offset') || 0)
    const limit = Number(url.searchParams.get('limit') || selected.length)
    selected = selected.slice(start, start + limit)
    const data = columns ? selected.map((row) => Object.fromEntries(columns.map((key) => [key, row[key]]).filter(([, value]) => value !== undefined))) : selected
    if (method !== 'GET' && !headers.get('Prefer')?.includes('return=representation')) return new Response(null, { status: 204 })
    if (headers.get('Accept')?.includes('vnd.pgrst.object')) return data.length === 1 ? json(data[0]) : json({ code: 'PGRST116', details: `${data.length} rows`, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
    return json(data)
  }
  return { state, fetchImpl, rows }
}
