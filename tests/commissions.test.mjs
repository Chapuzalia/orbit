import test from 'node:test'
import assert from 'node:assert/strict'
import { commissionSummary, validateCommission, commissionFromRow, commissionValues, newCommission, commissionPeriod } from '../lib/commissions.mjs'
const agreement = (values = {}) => ({ plan: 'pro', monthlyAmount: 49, bonusMultiplier: 1, rate: 10, firstMonth: 3, lastMonth: 60, startMonth: '2026-01', status: 'active', endedMonth: 0, receipts: [], ...values })
const receipt = (month, amount = 49) => ({ month, amount, date: '2026-10-01' })

test('reference formula calculates the five-year totals for every example', () => {
  for (const [monthlyAmount, bonusMultiplier, expected] of [[29, .5, 182.70], [49, 1, 333.20], [79, 1, 537.20], [104, 1, 707.20], [129, 1, 877.20]]) {
    const result = commissionSummary(agreement({ monthlyAmount, bonusMultiplier }))
    assert.equal(result.lifetimeEstimate, expected)
    assert.equal(result.earned, 0)
  }
  // The formula for 104 € is 104 + 58 × 10,40 = 707,20 €.
})
test('bonus requires first and second paid quotas and uses actual second software base', () => {
  assert.equal(commissionSummary(agreement({ receipts: [receipt(2)] })).bonus, 0)
  assert.equal(commissionSummary(agreement({ receipts: [receipt(1)] })).bonus, 0)
  const result = commissionSummary(agreement({ plan: 'basic', bonusMultiplier: .5, receipts: [receipt(1, 29), receipt(2, 25)] }))
  assert.equal(result.bonus, 12.5)
  assert.equal(result.recurring, 0)
})
test('recurring commission only for paid months 3 through 60, with rounding per quota', () => {
  const result = commissionSummary(agreement({ receipts: [receipt(1), receipt(2), receipt(3, 49.95), receipt(60, 100), receipt(61, 100)] }))
  assert.equal(result.recurring, 15)
  assert.equal(result.earned, 64)
})
test('early cancellation or nonpayment reverses bonus; fourth paid quota protects it', () => {
  const early = commissionSummary(agreement({ status: 'ended', endedMonth: 3, receipts: [receipt(1), receipt(2), receipt(3)] }))
  assert.equal(early.clawback, 49)
  assert.equal(early.earned, 4.9)
  const mature = commissionSummary(agreement({ status: 'ended', endedMonth: 4, receipts: [receipt(1), receipt(2), receipt(3), receipt(4)] }))
  assert.equal(mature.clawback, 0)
  assert.equal(mature.earned, 58.8)
})
test('custom rates, zero commission, and window boundaries work', () => {
  assert.equal(commissionSummary(agreement({ rate: 12.5, firstMonth: 4, lastMonth: 6, receipts: [receipt(3), receipt(4, 100), receipt(6, 100), receipt(7)] })).recurring, 25)
  assert.equal(commissionSummary(agreement({ rate: 0, bonusMultiplier: 0, receipts: [receipt(1), receipt(2), receipt(3)] })).earned, 0)
})
test('rejects invalid periods, duplicate receipts, invalid dates and money precision', () => {
  for (const values of [{ rate: 101 }, { bonusMultiplier: -1 }, { rate: '' }, { monthlyAmount: 1.001 }, { firstMonth: 0 }, { firstMonth: 3.5 }, { lastMonth: 2 }, { lastMonth: 121 }, { startMonth: '2026-13' }, { plan: 'fake' }, { status: 'fake' }, { receipts: [receipt(3), receipt(3)] }, { receipts: [{ ...receipt(3), date: '2026-02-30' }] }, { receipts: [{ ...receipt(3), date: '2025-12-01' }] }, { receipts: [receipt(3, 0)] }, { receipts: [receipt(3, 1.001)] }, { status: 'ended', endedMonth: 2, receipts: [receipt(3)] }]) assert.throws(() => validateCommission(agreement(values)))
})
test('wire values round-trip, normalize receipt order and retain historical owner', () => {
  const payload = commissionValues(agreement({ receipts: [receipt(3), receipt(1)] }))
  const mapped = commissionFromRow({ id: 'id', client_id: 'client', sales_rep_id: 'original', ...payload })
  assert.equal(mapped.salesRepId, 'original')
  assert.deepEqual(mapped.receipts.map((r) => r.month), [1, 3])
  assert.equal(mapped.rate, 10)
})
test('billing cycle suggests monthly base, leaving start and actual collections unfilled', () => {
  assert.equal(newCommission({ billingCycle: 'annual', billingAmount: 1200 }).monthlyAmount, 100)
  assert.equal(newCommission({ billingCycle: 'one_time', billingAmount: 1200 }).monthlyAmount, 0)
  assert.equal(newCommission({}).startMonth, '')
  assert.equal(commissionPeriod('2026-12', 3), 'feb 2027')
})
