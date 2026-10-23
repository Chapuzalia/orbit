import { recurringRevenue } from './client-billing.mjs'
import { recurringExpenses, EXPENSE_CATEGORIES } from './expenses.mjs'

const cents = (value) => Math.round(Number(value || 0) * 100)
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

export function currentMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(now)
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`
}

export function offsetMonth(key, offset) {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7)
}

export function monthLabel(key) {
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`))
}

export function recurringOverview(clients, expenses) {
  const revenue = recurringRevenue(clients)
  const costs = recurringExpenses(expenses)
  const profitCents = cents(revenue.mrr) - cents(costs.monthly.net)
  return { revenue: revenue.mrr, costs: costs.monthly.net, profit: profitCents / 100,
    annualRevenue: revenue.arr, annualCosts: costs.annual.net,
    annualProfit: (cents(revenue.arr) - cents(costs.annual.net)) / 100,
    margin: revenue.mrr > 0 ? profitCents / cents(revenue.mrr) * 100 : null,
    recurringClients: revenue.recurringClients, recurringCosts: costs.count }
}

export function forecastMonths({ clients, expenses, horizon = 6, revenueGrowth = 0, costGrowth = 0, now = new Date() }) {
  if (![3, 6, 12].includes(horizon)) throw new Error('Selecciona 3, 6 o 12 meses.')
  for (const rate of [revenueGrowth, costGrowth]) {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < -100 || rate > 100) throw new Error('La variación mensual debe estar entre −100 % y 100 %.')
  }
  const baseline = recurringOverview(clients, expenses)
  const start = currentMonthKey(now)
  const punctualByMonth = new Map()
  for (const expense of expenses) {
    if (expense.status !== 'active' || expense.billingCycle !== 'one_time' || !validDate(expense.chargeDate)) continue
    const month = expense.chargeDate.slice(0, 7)
    punctualByMonth.set(month, (punctualByMonth.get(month) || 0) + cents(expense.netAmount))
  }
  let cumulativeCents = 0
  return Array.from({ length: horizon }, (_, index) => {
    const key = offsetMonth(start, index + 1)
    const revenueCents = Math.round(cents(baseline.revenue) * (1 + revenueGrowth / 100) ** (index + 1))
    const recurringCents = Math.round(cents(baseline.costs) * (1 + costGrowth / 100) ** (index + 1))
    const punctualCents = punctualByMonth.get(key) || 0
    const costsCents = recurringCents + punctualCents
    const profitCents = revenueCents - costsCents
    cumulativeCents += profitCents
    return { key, month: monthLabel(key), revenue: revenueCents / 100, costs: costsCents / 100,
      recurringCosts: recurringCents / 100, punctualCosts: punctualCents / 100, profit: profitCents / 100, cumulative: cumulativeCents / 100 }
  })
}

export function salesRepRanking(salesReps, clients, sortBy = 'clients') {
  const groups = new Map(salesReps.map((rep) => [rep.id, { ...rep, clients: [] }]))
  const unassigned = []
  for (const client of clients) {
    const group = groups.get(client.salesRepId)
    if (group) group.clients.push(client)
    else unassigned.push(client)
  }
  const summarize = (group) => ({ id: group.id, name: group.name, clients: group.clients.length,
    active: group.clients.filter((client) => client.status === 'active').length, mrr: recurringRevenue(group.clients).mrr })
  const metric = ['clients', 'active', 'mrr'].includes(sortBy) ? sortBy : 'clients'
  const ranking = [...groups.values()].map(summarize).sort((a, b) => b[metric] - a[metric] || b.clients - a.clients || a.name.localeCompare(b.name, 'es'))
  return { ranking, unassigned: summarize({ id: '', name: 'Sin comercial', clients: unassigned }) }
}

export function expenseCategoryBreakdown(expenses) {
  const total = recurringExpenses(expenses).annual.net
  return Object.entries(EXPENSE_CATEGORIES).map(([id, name]) => {
    const grouped = expenses.filter((expense) => expense.category === id)
    const values = recurringExpenses(grouped)
    return { id, name, monthly: values.monthly.net, annual: values.annual.net, count: values.count,
      share: total > 0 ? values.annual.net / total * 100 : 0 }
  }).filter((category) => category.count > 0).sort((a, b) => b.annual - a.annual || a.name.localeCompare(b.name, 'es'))
}

export function invoiceHistory(invoices, { months = 6, now = new Date() } = {}) {
  if (![6, 12].includes(months)) throw new Error('Selecciona un periodo de 6 o 12 meses.')
  const current = currentMonthKey(now)
  const buckets = Array.from({ length: months }, (_, index) => ({ key: offsetMonth(current, index - months + 1), totalCents: 0, paidCents: 0, pendingCents: 0, count: 0 }))
  const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  let undated = 0
  for (const invoice of invoices) {
    if (!['paid', 'sent', 'pending', 'overdue'].includes(invoice.status)) continue
    if (typeof invoice.issued !== 'string' || !validDate(invoice.issued.slice(0, 10))) { undated++; continue }
    const bucket = byMonth.get(invoice.issued.slice(0, 7))
    if (!bucket || !Number.isFinite(Number(invoice.amount))) continue
    const amount = cents(invoice.amount)
    bucket.totalCents += amount
    bucket.count++
    if (invoice.status === 'paid') bucket.paidCents += amount
    else bucket.pendingCents += amount
  }
  return { months: buckets.map((bucket) => ({ key: bucket.key, month: monthLabel(bucket.key), total: bucket.totalCents / 100, paid: bucket.paidCents / 100, pending: bucket.pendingCents / 100, count: bucket.count })), undated }
}
