import { BILLING_CYCLES, MAX_BILLING_AMOUNT } from './client-billing.mjs'

export const EXPENSE_CYCLES = Object.fromEntries(Object.entries(BILLING_CYCLES).filter(([key]) => key !== 'none'))
export const EXPENSE_CATEGORIES = {
  software: 'Software y suscripciones', infrastructure: 'Infraestructura', services: 'Servicios profesionales',
  marketing: 'Marketing', office: 'Oficina', taxes: 'Impuestos y tasas', other: 'Otros',
}
export const VAT_TYPES = { rate: 'Con IVA', exempt: 'Exento', not_subject: 'No sujeto', reverse_charge: 'Inversión del sujeto pasivo' }
export const VAT_OPTIONS = [
  { value: '21', label: '21 %' }, { value: '10', label: '10 %' }, { value: '4', label: '4 %' }, { value: '0', label: '0 %' },
  { value: 'exempt', label: 'Exento' }, { value: 'not_subject', label: 'No sujeto' },
  { value: 'reverse_charge', label: 'Inversión del sujeto pasivo' }, { value: 'custom', label: 'Otro porcentaje' },
]

const has = (map, key) => Object.hasOwn(map, key)
const validDecimal = (value, max) => Number.isFinite(value) && value >= 0 && value <= max && Math.abs(value * 100 - Math.round(value * 100)) <= 0.0001

export function expenseValues(values) {
  const name = String(values.name || '').trim()
  const supplier = String(values.supplier || '').trim()
  const notes = String(values.notes || '').trim()
  const netAmount = Number(values.netAmount)
  const vatRate = Number(values.vatRate)
  if (!name || name.length > 200) throw new Error('Introduce un nombre de hasta 200 caracteres.')
  if (supplier.length > 200 || notes.length > 5000) throw new Error('El proveedor admite 200 caracteres y las notas, 5.000.')
  if (!has(EXPENSE_CATEGORIES, values.category)) throw new Error('Selecciona una categoría válida.')
  if (!has(EXPENSE_CYCLES, values.billingCycle)) throw new Error('Selecciona un ciclo de cobro válido.')
  if (!['active', 'paused'].includes(values.status)) throw new Error('Selecciona un estado válido.')
  if (!has(VAT_TYPES, values.vatType)) throw new Error('Selecciona un tratamiento de IVA válido.')
  if (values.netAmount === '' || values.netAmount == null || !validDecimal(netAmount, MAX_BILLING_AMOUNT)) throw new Error('Introduce un importe sin IVA válido, con un máximo de dos decimales.')
  if (values.vatRate === '' || values.vatRate == null || !validDecimal(vatRate, 100)) throw new Error('El IVA debe estar entre 0 y 100 %, con un máximo de dos decimales.')
  if (values.vatType !== 'rate' && vatRate !== 0) throw new Error('Este tratamiento de IVA debe tener un porcentaje de 0 %.')
  const chargeDate = values.chargeDate || ''
  if (chargeDate && (!/^\d{4}-\d{2}-\d{2}$/.test(chargeDate) || Number.isNaN(Date.parse(chargeDate)) || new Date(`${chargeDate}T00:00:00Z`).toISOString().slice(0, 10) !== chargeDate)) throw new Error('Introduce una fecha de cobro válida.')
  return { name, supplier, category: values.category, net_amount: Math.round(netAmount * 100) / 100,
    vat_type: values.vatType, vat_rate: vatRate, billing_cycle: values.billingCycle, status: values.status,
    charge_date: chargeDate ? `${chargeDate} 12:00:00.000Z` : '', notes }
}

export function expenseAmounts(expense) {
  const netCents = Math.round(Number(expense.netAmount || 0) * 100)
  const rateHundredths = Math.round(Number(expense.vatRate || 0) * 100)
  const vatCents = expense.vatType === 'rate' ? Math.round(netCents * rateHundredths / 10000) : 0
  return { net: netCents / 100, vat: vatCents / 100, total: (netCents + vatCents) / 100 }
}

export function recurringExpenses(expenses) {
  let netCents = 0
  let vatCents = 0
  let count = 0
  for (const expense of expenses) {
    const cycle = has(EXPENSE_CYCLES, expense.billingCycle) ? EXPENSE_CYCLES[expense.billingCycle] : null
    if (expense.status !== 'active' || !cycle?.months) continue
    const amounts = expenseAmounts(expense)
    const multiplier = 12 / cycle.months
    netCents += Math.round(amounts.net * 100) * multiplier
    vatCents += Math.round(amounts.vat * 100) * multiplier
    count++
  }
  const totals = (divisor) => {
    const net = Math.round(netCents / divisor)
    const vat = Math.round(vatCents / divisor)
    return { net: net / 100, vat: vat / 100, total: (net + vat) / 100 }
  }
  return { monthly: totals(12), annual: totals(1), count }
}

export function expenseVatLabel(expense) {
  return expense.vatType === 'rate' ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(expense.vatRate)} %` : VAT_TYPES[expense.vatType] || 'Sin configurar'
}
