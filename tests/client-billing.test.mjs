import { test } from 'node:test'
import assert from 'node:assert/strict'
import { billingValues, recurringRevenue } from '../lib/client-billing.mjs'

test('normalizes every recurring cycle to monthly and annual revenue', () => {
  for (const [billingCycle, billingAmount] of [['monthly', 100], ['bimonthly', 200], ['quarterly', 300], ['semiannual', 600], ['annual', 1200]]) {
    assert.deepEqual(recurringRevenue([{ status: 'active', billingCycle, billingAmount }]), { mrr: 100, arr: 1200, recurringClients: 1 })
  }
})

test('only active recurring clients contribute, independent of historical revenue', () => {
  const clients = [
    { status: 'active', billingCycle: 'monthly', billingAmount: 25.5, revenue: 50000 },
    { status: 'active', billingCycle: 'annual', billingAmount: 1200 },
    ...['lead', 'contacted', 'proposal', 'inactive', 'lost'].map((status) => ({ status, billingCycle: 'monthly', billingAmount: 999 })),
    ...['none', 'one_time', '', 'invalid', 'constructor'].map((billingCycle) => ({ status: 'active', billingCycle, billingAmount: 999 })),
    ...[0, -1, NaN, Infinity].map((billingAmount) => ({ status: 'active', billingCycle: 'monthly', billingAmount })),
    { status: 'active' },
  ]
  assert.deepEqual(recurringRevenue(clients), { mrr: 125.5, arr: 1506, recurringClients: 2 })
  assert.deepEqual(recurringRevenue([]), { mrr: 0, arr: 0, recurringClients: 0 })
})

test('rounds the monthly total once and preserves annual cents', () => {
  const clients = Array.from({ length: 12 }, () => ({ status: 'active', billingCycle: 'annual', billingAmount: 0.01 }))
  assert.deepEqual(recurringRevenue(clients), { mrr: 0.01, arr: 0.12, recurringClients: 12 })
  assert.deepEqual(recurringRevenue([{ status: 'active', billingCycle: 'annual', billingAmount: 1200.01 }]), { mrr: 100, arr: 1200.01, recurringClients: 1 })
})

test('validates billing amounts and leaves existing clients unconfigured', () => {
  assert.deepEqual(billingValues({}), { billing_cycle: 'none', billing_amount: 0 })
  assert.deepEqual(billingValues({ billingCycle: 'quarterly', billingAmount: '250.99' }), { billing_cycle: 'quarterly', billing_amount: 250.99 })
  assert.deepEqual(billingValues({ billingCycle: 'monthly', billingAmount: '0' }), { billing_cycle: 'monthly', billing_amount: 0 })
  for (const billingAmount of [-1, NaN, 'abc', Infinity, '12.345', 1000000000]) assert.throws(() => billingValues({ billingCycle: 'monthly', billingAmount }))
  for (const billingCycle of ['invalid', 'constructor', 'toString']) assert.throws(() => billingValues({ billingCycle, billingAmount: 10 }))
  assert.throws(() => billingValues({ billingCycle: 'none', billingAmount: 10 }))
})
