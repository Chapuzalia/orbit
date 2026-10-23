import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expenseValues, expenseAmounts, recurringExpenses } from '../lib/expenses.mjs'

const expense = { name: ' Hosting ', supplier: ' Proveedor ', category: 'infrastructure', netAmount: '100.00', vatType: 'rate', vatRate: '21', billingCycle: 'monthly', status: 'active', chargeDate: '2026-11-01', notes: ' Notas ' }

test('expense validation trims text, preserves the charge date and maps only supported fields', () => {
  assert.deepEqual(expenseValues({ ...expense, organization_id: 'foreign' }), { name: 'Hosting', supplier: 'Proveedor', category: 'infrastructure', net_amount: 100, vat_type: 'rate', vat_rate: 21, billing_cycle: 'monthly', status: 'active', charge_date: '2026-11-01 12:00:00.000Z', notes: 'Notas' })
  assert.equal(expenseValues({ ...expense, chargeDate: '' }).charge_date, '')
  assert.equal(expenseValues({ ...expense, chargeDate: '2024-02-29' }).charge_date, '2024-02-29 12:00:00.000Z')
  for (const chargeDate of ['2026-02-29', '2026-02-31', '2026-13-01', 'invalid', '2026-1-1']) assert.throws(() => expenseValues({ ...expense, chargeDate }))
})

test('rejects invalid amounts, percentages, required data and unknown options', () => {
  for (const netAmount of ['', null, NaN, Infinity, -1, 1.001, 1000000000]) assert.throws(() => expenseValues({ ...expense, netAmount }))
  for (const vatRate of ['', null, NaN, Infinity, -1, 100.01, 7.555]) assert.throws(() => expenseValues({ ...expense, vatRate }))
  for (const values of [{ name: ' ' }, { name: 'x'.repeat(201) }, { supplier: 'x'.repeat(201) }, { notes: 'x'.repeat(5001) }, { category: 'constructor' }, { billingCycle: 'none' }, { billingCycle: 'constructor' }, { status: 'invalid' }, { vatType: 'constructor' }]) assert.throws(() => expenseValues({ ...expense, ...values }))
  assert.equal(expenseValues({ ...expense, netAmount: 0 }).net_amount, 0)
  assert.equal(expenseValues({ ...expense, vatRate: 7.5 }).vat_rate, 7.5)
})

test('calculates invoice VAT for preset and custom rates with cent rounding', () => {
  for (const [vatRate, vat] of [[21, 21], [10, 10], [4, 4], [0, 0], [7.5, 7.5]]) assert.deepEqual(expenseAmounts({ ...expense, vatRate }), { net: 100, vat, total: 100 + vat })
  assert.deepEqual(expenseAmounts({ ...expense, netAmount: 0.05, vatRate: 10 }), { net: 0.05, vat: 0.01, total: 0.06 })
  assert.deepEqual(expenseAmounts({ ...expense, netAmount: 99.99, vatRate: 7.5 }), { net: 99.99, vat: 7.5, total: 107.49 })
})

test('distinguishes zero rate, exempt, not subject and reverse charge with no supplier VAT', () => {
  for (const vatType of ['exempt', 'not_subject', 'reverse_charge']) {
    assert.throws(() => expenseValues({ ...expense, vatType }))
    assert.equal(expenseValues({ ...expense, vatType, vatRate: 0 }).vat_type, vatType)
    assert.deepEqual(expenseAmounts({ ...expense, vatType, vatRate: 0 }), { net: 100, vat: 0, total: 100 })
  }
})

test('normalizes every recurring cycle, excludes paused and one-off expenses', () => {
  for (const [billingCycle, netAmount] of [['monthly', 100], ['bimonthly', 200], ['quarterly', 300], ['semiannual', 600], ['annual', 1200]]) {
    assert.deepEqual(recurringExpenses([{ ...expense, billingCycle, netAmount }]), { monthly: { net: 100, vat: 21, total: 121 }, annual: { net: 1200, vat: 252, total: 1452 }, count: 1 })
  }
  assert.deepEqual(recurringExpenses([
    expense, { ...expense, billingCycle: 'annual', netAmount: 1200, vatRate: 10 },
    { ...expense, status: 'paused' }, { ...expense, billingCycle: 'one_time' }, { ...expense, billingCycle: 'constructor' },
  ]), { monthly: { net: 200, vat: 31, total: 231 }, annual: { net: 2400, vat: 372, total: 2772 }, count: 2 })
  assert.deepEqual(recurringExpenses([]), { monthly: { net: 0, vat: 0, total: 0 }, annual: { net: 0, vat: 0, total: 0 }, count: 0 })
})

test('monthly displayed components add up after rounding', () => {
  const values = recurringExpenses([{ ...expense, netAmount: 0.06, vatRate: 100, billingCycle: 'annual' }])
  assert.deepEqual(values.monthly, { net: 0.01, vat: 0.01, total: 0.02 })
  assert.deepEqual(values.annual, { net: 0.06, vat: 0.06, total: 0.12 })
})
