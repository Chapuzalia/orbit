import PocketBase, { BaseAuthStore } from 'pocketbase'
import { randomBytes } from 'node:crypto'
import { requireWorkspace } from '../lib/workspace.mjs'
import { billingValues } from '../lib/client-billing.mjs'
import { expenseValues } from '../lib/expenses.mjs'
import { commissionFromRow, commissionValues, commissionSummary } from '../lib/commissions.mjs'
import { recurringOverview, forecastMonths, salesRepRanking, expenseCategoryBreakdown, invoiceHistory } from '../lib/statistics.mjs'
import { entities } from './schema.mjs'

export function readConfig(env = process.env) {
  const url = (env.ORBIT_POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL || '').replace(/\/+$/, '')
  if (!url) throw new Error('Configura ORBIT_POCKETBASE_URL.')
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('URL de PocketBase inválida.')
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('PocketBase remoto requiere HTTPS.')
  if (!env.ORBIT_USER_TOKEN && !(env.ORBIT_USER_EMAIL && env.ORBIT_USER_PASSWORD)) throw new Error('Configura ORBIT_USER_TOKEN o ORBIT_USER_EMAIL y ORBIT_USER_PASSWORD.')
  return { url, token: env.ORBIT_USER_TOKEN, email: env.ORBIT_USER_EMAIL, password: env.ORBIT_USER_PASSWORD,
    organizationId: env.ORBIT_ORGANIZATION_ID, readOnly: env.ORBIT_MCP_READ_ONLY === 'true', allowSecrets: env.ORBIT_MCP_ALLOW_SECRETS === 'true' }
}

export function publicRecord(record, { secrets = false } = {}) {
  const { password, recovery, notes, agent_token_hash, tokenKey, ...safe } = record
  if (record.collectionName === 'credentials') {
    return secrets ? { ...safe, password, recovery, notes } : { ...safe, secrets_redacted: true }
  }
  if (record.collectionName === 'servers') {
    const checkedAt = record.last_check ? Date.parse(record.last_check.replace(' ', 'T')) : NaN
    return { ...safe, effective_status: !Number.isFinite(checkedAt) || Date.now() - checkedAt > 180000 ? 'offline' : record.status || 'operational' }
  }
  return { ...safe, ...(notes !== undefined ? { notes } : {}) }
}

export function safeError(error) {
  const status = Number(error.status || 0)
  if (status) return { code: `POCKETBASE_${status}`, message: ({ 400: 'Datos inválidos o relación no permitida. Revisa los campos y el workspace.', 401: 'Sesión no válida. Revisa las credenciales de la cuenta MCP.', 403: 'La cuenta no tiene permiso para esta operación.', 404: 'Registro no encontrado o sin acceso.' })[status] || 'No se pudo completar la operación en PocketBase.' }
  return { code: 'ORBIT_MCP_ERROR', message: error.message || 'No se pudo completar la operación.' }
}

const camel = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]))

export class OrbitService {
  constructor(config, { createClient = () => new PocketBase(config.url, new BaseAuthStore()) } = {}) { this.config = config; this.createClient = createClient }

  async connect() {
    const pb = this.createClient()
    pb.autoCancellation(false)
    pb.beforeSend = (url, options) => ({ url, options: { ...options, signal: options.signal || AbortSignal.timeout(15000) } })
    if (this.config.token) {
      pb.authStore.save(this.config.token, null)
      await pb.collection('users').authRefresh()
    } else await pb.collection('users').authWithPassword(this.config.email, this.config.password)
    const user = pb.authStore.record
    if (user?.collectionName !== 'users') throw new Error('El MCP requiere una cuenta de users de Orbit.')
    const org = requireWorkspace(user)
    if (this.config.organizationId && this.config.organizationId !== org) throw new Error('El workspace de la cuenta no coincide con ORBIT_ORGANIZATION_ID.')
    await pb.collection('organizations').getOne(org)
    return { pb, user, org }
  }

  assertWrite() { if (this.config.readOnly) throw new Error('El MCP está configurado en modo solo lectura.') }
  assertSecrets() { if (!this.config.allowSecrets) throw new Error('La lectura de secretos requiere ORBIT_MCP_ALLOW_SECRETS=true.') }
  scope(pb, org) { return pb.filter('organization_id = {:org}', { org }) }
  async owned(ctx, entity, recordId) {
    const row = await ctx.pb.collection(entity).getOne(recordId)
    if (row.organization_id !== ctx.org) throw new Error('Registro fuera del workspace.')
    return row
  }

  async execute(entity, operation, args) {
    if (!entities[entity]?.operations.includes(operation)) throw new Error('Operación no disponible.')
    if (!['list', 'get'].includes(operation)) this.assertWrite()
    const ctx = await this.connect()
    const { pb, user, org } = ctx
    if (operation === 'list') {
      const operators = { eq: '=', ne: '!=', contains: '~', gt: '>', gte: '>=', lt: '<', lte: '<=' }
      const filter = [this.scope(pb, org), ...args.filters.map((f) => pb.filter(`${f.field} ${operators[f.operator]} {:value}`, { value: f.value }))].map((part) => `(${part})`).join(' && ')
      const result = await pb.collection(entity).getList(args.page, args.per_page, { filter, sort: args.sort.map((s) => `${s.direction === 'desc' ? '-' : ''}${s.field}`).join(',') || '-created' })
      return { ...result, items: result.items.map((row) => publicRecord(row)) }
    }
    if (operation === 'get') return publicRecord(await this.owned(ctx, entity, args.id))
    if (operation === 'delete') {
      if (args.confirm !== true) throw new Error('El borrado requiere confirm=true.')
      await this.owned(ctx, entity, args.id)
      await pb.collection(entity).delete(args.id)
      return { deleted: true, id: args.id }
    }
    if (entity === 'servers') {
      const agentToken = randomBytes(32).toString('base64url')
      const row = await pb.send('/api/orbit/servers', { method: 'POST', body: { domains: [], services: [], ...args.data, organization_id: org, agent_token: agentToken } })
      return { server: publicRecord(row), agent_token: agentToken, instructions: 'Guarda este token en ORBIT_SERVER_TOKEN en el VPS; solo se entrega durante el alta.' }
    }
    const existing = operation === 'update' ? await this.owned(ctx, entity, args.id) : {}
    let values = { ...args.data }
    if (operation === 'create') {
      const defaults = { clients: { status: 'lead' }, credentials: { category: 'other' }, invoices: { status: 'draft' }, payments: { status: 'pending' }, subscriptions: { status: 'active', interval: 'month' }, sales_commissions: { ended_month: 0 } }
      values = { ...defaults[entity], ...values }
    }
    if (entity === 'clients') {
      const merged = { ...existing, ...values }
      Object.assign(values, billingValues({ billingCycle: merged.billing_cycle, billingAmount: merged.billing_amount }))
    }
    if (entity === 'expenses') values = expenseValues({ ...camel(existing), ...camel(values), chargeDate: (values.charge_date ?? existing.charge_date ?? '').slice(0, 10) })
    if (entity === 'sales_commissions') values = { ...values, ...commissionValues(camel({ ...existing, ...values })) }
    if (operation === 'create') {
      values.organization_id = org
      if (entity === 'credentials') values.created_by = user.id
      return publicRecord(await pb.collection(entity).create(values))
    }
    return publicRecord(await pb.collection(entity).update(args.id, values))
  }

  async identity() {
    const { pb, user, org } = await this.connect()
    return { user: publicRecord(user), organization: publicRecord(await pb.collection('organizations').getOne(org)), permissions: { read_only: this.config.readOnly, read_secrets: this.config.allowSecrets } }
  }

  async updateSettings(kind, data) {
    this.assertWrite()
    const { pb, user, org } = await this.connect()
    if (!Object.keys(data).length) throw new Error('Indica al menos un campo.')
    if (kind === 'profile') return publicRecord(await pb.collection('users').update(user.id, data))
    if (kind === 'organization') return publicRecord(await pb.collection('organizations').update(org, data))
    const result = await pb.collection('user_preferences').getList(1, 1, { filter: pb.filter('organization_id = {:org} && user_id = {:user}', { org, user: user.id }) })
    if (data.notifications) data = { ...data, notifications: { ...result.items[0]?.notifications, ...data.notifications } }
    return publicRecord(result.items[0]
      ? await pb.collection('user_preferences').update(result.items[0].id, data)
      : await pb.collection('user_preferences').create({ ...data, organization_id: org, user_id: user.id }))
  }

  async preferences() {
    const { pb, user, org } = await this.connect()
    const { items } = await pb.collection('user_preferences').getList(1, 1, { filter: pb.filter('organization_id = {:org} && user_id = {:user}', { org, user: user.id }) })
    return { preferences: items[0] ? publicRecord(items[0]) : null }
  }

  async revealCredential(recordId) {
    this.assertSecrets()
    const ctx = await this.connect()
    return publicRecord(await this.owned(ctx, 'credentials', recordId), { secrets: true })
  }

  async markAllRead() {
    this.assertWrite()
    const ctx = await this.connect()
    const rows = await this.all(ctx, 'notifications', 'read = false')
    let updated = 0
    for (const row of rows) {
      try { await ctx.pb.collection('notifications').update(row.id, { read: true }); updated++ }
      catch (error) { return { updated, remaining: rows.length - updated, error: safeError(error) } }
    }
    return { updated, remaining: 0 }
  }

  async all({ pb, org }, entity, extra = '') {
    const rows = []
    for (let page = 1; page <= 101; page++) {
      const { items } = await pb.collection(entity).getList(page, 100, { filter: `${this.scope(pb, org)}${extra ? ` && (${extra})` : ''}`, sort: 'id', skipTotal: true })
      rows.push(...items)
      if (rows.length > 10000) throw new Error('El informe supera 10.000 registros; utiliza las listas paginadas para procesarlo.')
      if (items.length < 100) return rows
    }
    throw new Error('El informe supera el límite de registros.')
  }

  async statistics(options = {}) {
    const ctx = await this.connect()
    const [clients, expenses, reps, invoices, servers] = await Promise.all(['clients', 'expenses', 'sales_reps', 'invoices', 'servers'].map((entity) => this.all(ctx, entity)))
    const c = clients.map(camel)
    const e = expenses.map((row) => ({ ...camel(row), chargeDate: row.charge_date?.slice(0, 10) || '' }))
    const now = new Date()
    return { generated_at: now.toISOString(), currency: (await ctx.pb.collection('organizations').getOne(ctx.org)).currency || 'EUR',
      overview: recurringOverview(c, e), forecast: forecastMonths({ clients: c, expenses: e, now, ...options }),
      sales_reps: salesRepRanking(reps, c, 'mrr'), expenses_by_category: expenseCategoryBreakdown(e), invoices: invoiceHistory(invoices, { months: 12, now }),
      dashboard: { active_clients: clients.filter((r) => r.status === 'active').length, pending_invoices: invoices.filter((r) => ['pending', 'overdue', 'sent'].includes(r.status)).length,
        servers_with_issues: servers.filter((r) => !r.last_check || now - new Date(r.last_check.replace(' ', 'T')) > 180000 || ['warning', 'critical', 'offline'].includes(r.status)).length },
      note: 'Estimaciones recurrentes sin IVA; no representan cobros, pagos ni liquidaciones fiscales. Las facturas y las suscripciones son registros locales; no se emiten ni cobran en proveedores externos.' }
  }

  async commission(recordId) {
    const ctx = await this.connect()
    const agreement = commissionFromRow(await this.owned(ctx, 'sales_commissions', recordId))
    return { agreement, summary: commissionSummary(agreement) }
  }
}
