import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentMonthKey, offsetMonth, recurringOverview, forecastMonths, salesRepRanking, expenseCategoryBreakdown, invoiceHistory } from '../lib/statistics.mjs'

const now = new Date('2026-10-24T12:00:00Z')
const client = { id: 'client1', name: 'Cliente', status: 'active', salesRepId: 'ana', billingCycle: 'monthly', billingAmount: 100 }
const expense = { id: 'expense1', name: 'Hosting', status: 'active', category: 'infrastructure', billingCycle: 'monthly', netAmount: 40, vatType: 'rate', vatRate: 21, chargeDate: '' }

test('uses Madrid calendar months and handles year rollover', () => {
  assert.equal(currentMonthKey(new Date('2026-10-31T23:30:00Z')), '2026-11')
  assert.equal(offsetMonth('2026-12', 1), '2027-01')
  assert.equal(offsetMonth('2026-01', -1), '2025-12')
})

test('compares recurring revenue with net expenses and supports loss and zero-income states', () => {
  const values = recurringOverview([client], [expense])
  assert.equal(values.revenue, 100)
  assert.equal(values.costs, 40)
  assert.equal(values.profit, 60)
  assert.equal(values.margin, 60)
  assert.equal(values.annualProfit, 720)
  assert.equal(recurringOverview([], [expense]).profit, -40)
  assert.equal(recurringOverview([], [expense]).margin, null)
  assert.equal(recurringOverview([], []).profit, 0)
})

test('baseline starts next full month with consistent recurring amounts', () => {
  const rows = forecastMonths({ clients: [client], expenses: [expense], horizon: 3, now })
  assert.deepEqual(rows.map((row) => row.key), ['2026-11', '2026-12', '2027-01'])
  assert.deepEqual(rows.map((row) => row.profit), [60, 60, 60])
  assert.equal(rows.at(-1).cumulative, 180)
})

test('forecasts all supported horizons and compounds scenario changes from the first month', () => {
  for (const horizon of [3, 6, 12]) assert.equal(forecastMonths({ clients: [], expenses: [], horizon, now }).length, horizon)
  const rows = forecastMonths({ clients: [client], expenses: [expense], horizon: 3, revenueGrowth: 10, costGrowth: 5, now })
  assert.equal(rows[0].revenue, 110)
  assert.equal(rows[1].revenue, 121)
  assert.equal(rows[0].recurringCosts, 42)
  assert.equal(rows[1].recurringCosts, 44.1)
  assert.equal(rows[1].profit, 76.9)
  assert.equal(rows.at(-1).cumulative, 231.69)
  const zero = forecastMonths({ clients: [client], expenses: [expense], horizon: 3, revenueGrowth: -100, costGrowth: -100, now })
  assert.ok(zero.every((row) => row.profit === 0))
})

test('excludes nonrecurring income, inactive clients and paused expenses; adds dated one-off net costs once', () => {
  const rows = forecastMonths({ clients: [client, { ...client, status: 'lead', billingAmount: 999 }, { ...client, billingCycle: 'one_time', billingAmount: 999 }], expenses: [expense,
    { ...expense, status: 'paused', netAmount: 999 },
    { ...expense, billingCycle: 'one_time', chargeDate: '2026-12-15', netAmount: 50 },
    { ...expense, billingCycle: 'one_time', chargeDate: '', netAmount: 999 },
    { ...expense, billingCycle: 'one_time', chargeDate: '2026-11-31', netAmount: 999 },
    { ...expense, billingCycle: 'one_time', chargeDate: '2026-10-30', netAmount: 999 },
    { ...expense, billingCycle: 'one_time', chargeDate: '2027-12-15', netAmount: 999 },
  ], horizon: 3, now })
  assert.deepEqual(rows.map((row) => row.costs), [40, 90, 40])
  assert.deepEqual(rows.map((row) => row.punctualCosts), [0, 50, 0])
  assert.equal(rows.at(-1).cumulative, 130)
})

test('rejects unsupported horizons and non-finite or excessive scenario changes', () => {
  for (const horizon of [0, 5, 100]) assert.throws(() => forecastMonths({ clients: [], expenses: [], horizon }))
  for (const revenueGrowth of [NaN, Infinity, -101, 101, '10']) assert.throws(() => forecastMonths({ clients: [], expenses: [], revenueGrowth }))
})

test('ranks the current portfolio with deterministic ties and a separate unassigned bucket', () => {
  const reps = [{ id: 'ana', name: 'Ana' }, { id: 'luis', name: 'Luis' }, { id: 'empty', name: 'Sin cartera' }]
  const clients = [client, { ...client, id: '2', status: 'lead' }, { ...client, id: '3', salesRepId: 'luis', billingAmount: 250 }, { ...client, id: '4', salesRepId: '' }, { ...client, id: '5', salesRepId: 'removed', status: 'inactive' }]
  const result = salesRepRanking(reps, clients)
  assert.deepEqual(result.ranking.map((rep) => rep.id), ['ana', 'luis', 'empty'])
  assert.deepEqual(result.ranking[0], { id: 'ana', name: 'Ana', clients: 2, active: 1, mrr: 100 })
  assert.equal(result.unassigned.clients, 2)
  assert.equal(result.unassigned.mrr, 100)
  assert.equal(salesRepRanking(reps, clients, 'mrr').ranking[0].id, 'luis')
  assert.equal(salesRepRanking([], clients).unassigned.clients, clients.length)
})

test('category shares use active recurring net costs only', () => {
  const categories = expenseCategoryBreakdown([expense, { ...expense, category: 'software', netAmount: 120, billingCycle: 'quarterly' }, { ...expense, status: 'paused', netAmount: 999 }, { ...expense, billingCycle: 'one_time', netAmount: 999 }])
  assert.equal(categories.length, 2)
  assert.ok(categories.every((category) => category.monthly === 40 && category.share === 50))
  assert.deepEqual(expenseCategoryBreakdown([]), [])
})

test('invoice history uses issue months, excludes drafts/cancellations, and never adds aggregate revenue twice', () => {
  const invoices = [
    { issued: '2026-10-10', amount: 100.25, status: 'paid' },
    { issued: '2026-10-11', amount: 50.75, status: 'sent' },
    { issued: '2026-09-11', amount: 20, status: 'overdue' },
    { issued: '2026-10-12', amount: 999, status: 'draft' },
    { issued: '2026-10-12', amount: 999, status: 'cancelled' },
    { issued: '2026-10-12', amount: 'invalid', status: 'paid' },
    { issued: '2025-10-12', amount: 999, status: 'paid' },
    { issued: '2026-11-12', amount: 999, status: 'paid' },
    { issued: '', amount: 50, status: 'paid' },
    { issued: '2026-02-31', amount: 999, status: 'paid' },
  ]
  const result = invoiceHistory(invoices, { months: 6, now })
  assert.equal(result.months[0].key, '2026-05')
  assert.deepEqual(result.months.at(-1), { key: '2026-10', month: 'oct 26', total: 151, paid: 100.25, pending: 50.75, count: 2 })
  assert.equal(result.months.at(-2).pending, 20)
  assert.equal(result.undated, 2)
  assert.equal(invoiceHistory([], { months: 12, now }).months.length, 12)
})
