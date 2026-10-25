import PocketBase, { BaseAuthStore } from 'pocketbase'
import { randomBytes } from 'node:crypto'
import { ZodError } from 'zod'
import { readBoolean } from '../../core/config.mjs'
import { reservationColumns, listInput, reservationCreate, reservationUpdate, reservationDelete, reservationGet, availabilityInput, calendarInput } from './schema.mjs'

const collection = 'venue_reservations'
const select = reservationColumns.join(',')
export class MessError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details }
}
export function messError(error) {
  if (error instanceof MessError) return { code: error.code, message: error.message, ...error.details }
  if (error instanceof ZodError) return { code: 'INVALID_INPUT', message: 'Revisa fechas, horas y campos de la reserva.' }
  const status = Number(error?.status || 0)
  return { code: `MESS_POCKETBASE_${status || 'UNAVAILABLE'}`, message: ({
    400: 'PocketBase rechazó los datos. Revisa los campos de la reserva.', 401: 'La sesión de MESS no es válida. Revisa sus credenciales.',
    403: 'La cuenta de MESS no tiene permiso para esta operación.', 404: 'Reserva o endpoint no encontrado, o sin acceso.',
  })[status] || 'No se pudo completar la operación en PocketBase de MESS.' }
}

export function readMessConfig(env = process.env) {
  let parsed
  try { parsed = new URL(env.MESS_POCKETBASE_URL) } catch { throw new Error('Configura MESS_POCKETBASE_URL.') }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('MESS_POCKETBASE_URL debe ser el origen de PocketBase, sin rutas.')
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('PocketBase remoto de MESS requiere HTTPS.')
  const authCollection = env.MESS_AUTH_COLLECTION || 'users'
  if (!['users', '_superusers'].includes(authCollection)) throw new Error('MESS_AUTH_COLLECTION debe ser users o _superusers.')
  if (!env.MESS_USER_TOKEN && !(env.MESS_USER_EMAIL && env.MESS_USER_PASSWORD)) throw new Error('Configura MESS_USER_TOKEN o MESS_USER_EMAIL y MESS_USER_PASSWORD.')
  return { url: parsed.origin, authCollection, token: env.MESS_USER_TOKEN, email: env.MESS_USER_EMAIL, password: env.MESS_USER_PASSWORD,
    readOnly: readBoolean(env.MESS_READ_ONLY, false, 'MESS_READ_ONLY') }
}

export class MessService {
  constructor(config, { createClient = () => new PocketBase(config.url, new BaseAuthStore()), fetchImpl = fetch } = {}) {
    this.config = config; this.createClient = createClient; this.fetchImpl = fetchImpl
  }
  async connect() {
    const pb = this.createClient()
    pb.autoCancellation(false)
    pb.beforeSend = (url, options) => ({ url, options: { ...options, signal: options.signal || AbortSignal.timeout(15000),
      fetch: async (input, init) => {
        const response = await this.fetchImpl(input, { ...init, redirect: 'error' })
        if (!response.body) return response
        const reader = response.body.getReader(), chunks = []
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
      },
    } })
    if (this.config.token) {
      pb.authStore.save(this.config.token, null)
      if (this.config.authCollection === '_superusers') {
        // Impersonation/API tokens cannot be refreshed. Reading a private collection schema verifies superuser authority.
        await pb.collections.getOne(collection)
      } else await pb.collection('users').authRefresh()
    } else await pb.collection(this.config.authCollection).authWithPassword(this.config.email, this.config.password)
    const user = pb.authStore.record
    if ((!this.config.token || this.config.authCollection === 'users') && user?.collectionName !== this.config.authCollection) throw new MessError('AUTH_COLLECTION_MISMATCH', 'La cuenta no pertenece a la colección de autenticación configurada.')
    return pb
  }
  assertWrite(confirmation) {
    if (this.config.readOnly) throw new MessError('READ_ONLY', 'MESS está en modo solo lectura.')
    if (confirmation !== true) throw new MessError('CONFIRM_REQUIRED', 'La operación requiere confirm=true.')
  }
  publicRecord(row) {
    return Object.fromEntries(reservationColumns.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]))
  }
  async write(action, details) {
    try { return await action() }
    catch (error) {
      if (!error.status || error.status >= 500) throw new MessError('WRITE_OUTCOME_UNKNOWN', 'No se pudo confirmar el resultado. Consulta la reserva antes de repetir la escritura.', { outcome_unknown: true, ...details })
      throw error
    }
  }
  async identity() {
    const pb = await this.connect()
    // Check the actual collection in addition to authentication, without exporting tokens or private schema.
    await pb.collection(collection).getList(1, 1, { fields: 'id', skipTotal: true })
    return { connected: true, backend: 'pocketbase', auth_collection: this.config.authCollection, scope: 'venue_reservations',
      user: pb.authStore.record ? { id: pb.authStore.record.id, role: pb.authStore.record.role || (this.config.authCollection === '_superusers' ? 'superuser' : null) } : null,
      timezone: 'Europe/Madrid', read_only: this.config.readOnly }
  }
  filter(pb, input) {
    const filters = []
    if (input.from) filters.push(pb.filter('reservation_date >= {:from}', { from: input.from }))
    if (input.to) filters.push(pb.filter('reservation_date <= {:to}', { to: input.to }))
    for (const field of ['waiter_id', 'needs_dj', 'deposit_paid']) if (input[field] !== undefined) filters.push(pb.filter(`${field} = {:value}`, { value: input[field] }))
    if (input.search) filters.push(pb.filter('(concept ~ {:search} || contact_person ~ {:search} || contact_phone ~ {:search} || waiter_id ~ {:search})', { search: input.search }))
    return filters.map((part) => `(${part})`).join(' && ')
  }
  async list(input = {}) {
    const args = listInput.parse(input)
    const pb = await this.connect()
    const result = await pb.collection(collection).getList(args.page, args.per_page, { filter: this.filter(pb, args), sort: 'reservation_date,start_time,id', fields: select })
    return { page: result.page, per_page: result.perPage, total_items: result.totalItems, total_pages: result.totalPages,
      has_more: result.page < result.totalPages, timezone: 'Europe/Madrid', items: result.items.map((row) => this.publicRecord(row)) }
  }
  async get(input) {
    const { id } = reservationGet.parse(input)
    const pb = await this.connect()
    return this.publicRecord(await pb.collection(collection).getOne(id, { fields: select }))
  }
  async create(input) {
    this.assertWrite(input.confirm)
    const { data } = reservationCreate.parse(input)
    const pb = await this.connect()
    const id = randomBytes(15).toString('hex').slice(0, 15)
    const row = await this.write(() => pb.collection(collection).create({ id, ...data }, { fields: select }), { requested_id: id, operation: 'create' })
    return this.publicRecord(row)
  }
  async update(input) {
    this.assertWrite(input.confirm)
    const { id, data } = reservationUpdate.parse(input)
    const pb = await this.connect()
    const row = await this.write(() => pb.collection(collection).update(id, data, { fields: select }), { requested_id: id, operation: 'update' })
    return this.publicRecord(row)
  }
  async delete(input) {
    this.assertWrite(input.confirm)
    const { id } = reservationDelete.parse(input)
    const pb = await this.connect()
    await this.write(() => pb.collection(collection).delete(id), { requested_id: id, operation: 'delete' })
    return { deleted: true, id }
  }
  async availability(input) {
    const { date } = availabilityInput.parse(input)
    const pb = await this.connect()
    // Reuse the MESS hook: whole-day availability, past dates unavailable, Europe/Madrid.
    const result = await pb.send('/api/mess/venue-availability', { query: { date } })
    if (typeof result?.available !== 'boolean') throw new MessError('INVALID_AVAILABILITY_RESPONSE', 'El endpoint de disponibilidad devolvió una respuesta inesperada.')
    return { date, available: result.available, timezone: 'Europe/Madrid', policy: 'whole_day',
      note: 'Disponibilidad informativa: no bloquea el día ni garantiza exclusividad al crear una reserva.' }
  }
  async calendar(input) {
    const { month } = calendarInput.parse(input)
    const from = `${month}-01`
    // Date.UTC treats years 00–99 specially; use ISO parsing so leap years remain correct.
    const next = new Date(`${from}T00:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    const to = new Date(next.getTime() - 86400000).toISOString().slice(0, 10)
    const pb = await this.connect()
    const filter = this.filter(pb, { from, to })
    const rows = []
    for (let page = 1; ; page++) {
      const result = await pb.collection(collection).getList(page, 100, { filter, sort: 'reservation_date,start_time,id', fields: select })
      if (result.totalItems > 10000 || rows.length + result.items.length > 10000) throw new MessError('CALENDAR_LIMIT', 'El mes supera 10000 reservas. Usa reservations_list con paginación.')
      rows.push(...result.items.map((row) => this.publicRecord(row)))
      if (page >= result.totalPages || result.items.length === 0) break
    }
    const days = []
    for (let day = 1; day <= Number(to.slice(8)); day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`
      const reservations = rows.filter((row) => row.reservation_date === date)
      days.push({ date, count: reservations.length, occupied: reservations.length > 0, reservations })
    }
    return { month, from, to, timezone: 'Europe/Madrid', total_reservations: rows.length, occupied_days: days.filter((day) => day.occupied).length,
      needs_dj: rows.filter((row) => row.needs_dj).length, deposit_pending: rows.filter((row) => !row.deposit_paid).length, days,
      note: 'El calendario no es un bloqueo de disponibilidad. Las reservas no tienen duración ni estado cancelado en el esquema actual de MESS.' }
  }
}
