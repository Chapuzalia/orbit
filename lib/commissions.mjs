import rules from '../pocketbase/pb_hooks/lib/commission-rules.js'
import { BILLING_CYCLES } from './client-billing.mjs'

export const COMMISSION_PLANS = { basic: 'Basic', pro: 'Pro / Pro + módulos', business: 'Business', custom: 'Personalizado' }
export const validateCommission = rules.validate
export const commissionSummary = rules.calculate
export function newCommission(client) {
  const months = BILLING_CYCLES[client.billingCycle]?.months || 0
  return { plan: 'pro', monthlyAmount: months ? Math.round(client.billingAmount / months * 100) / 100 : 0, bonusMultiplier: 1, rate: 10,
    firstMonth: 3, lastMonth: 60, startMonth: '', status: 'active', endedMonth: 0, receipts: [] }
}
export function commissionFromRow(row) {
  return { id: row.id, clientId: row.client_id, salesRepId: row.sales_rep_id, ...validateCommission({ plan: row.plan, monthlyAmount: row.monthly_amount,
    bonusMultiplier: row.bonus_multiplier, rate: row.rate, firstMonth: row.first_month, lastMonth: row.last_month,
    startMonth: row.start_month, status: row.status, endedMonth: row.ended_month, receipts: row.receipts || [] }) }
}
export function commissionValues(values) {
  const v = validateCommission(values)
  return { plan: v.plan, monthly_amount: v.monthlyAmount, bonus_multiplier: v.bonusMultiplier, rate: v.rate,
    first_month: v.firstMonth, last_month: v.lastMonth, start_month: v.startMonth, status: v.status, ended_month: v.endedMonth, receipts: v.receipts }
}
export function commissionPeriod(startMonth, month) {
  const [year, first] = startMonth.split('-').map(Number)
  const date = new Date(Date.UTC(year, first + Number(month) - 2, 1))
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}
