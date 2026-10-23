export const BILLING_CYCLES = {
  none: { label: 'Sin configurar', months: 0 },
  monthly: { label: 'Mensual', months: 1 },
  bimonthly: { label: 'Bimestral', months: 2 },
  quarterly: { label: 'Trimestral', months: 3 },
  semiannual: { label: 'Semestral', months: 6 },
  annual: { label: 'Anual', months: 12 },
  one_time: { label: 'Puntual', months: 0 },
}

export const MAX_BILLING_AMOUNT = 999999999.99

export function billingValues({ billingCycle, billingAmount }) {
  const cycle = billingCycle || 'none'
  const amount = Number(billingAmount === '' || billingAmount == null ? 0 : billingAmount)
  if (!Object.hasOwn(BILLING_CYCLES, cycle)) throw new Error('Selecciona un ciclo de facturación válido.')
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_BILLING_AMOUNT || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) {
    throw new Error('Introduce un importe entre 0 y 999.999.999,99 €, con un máximo de dos decimales.')
  }
  if (cycle === 'none' && amount !== 0) throw new Error('Selecciona un ciclo para indicar el importe a facturar.')
  return { billing_cycle: cycle, billing_amount: Math.round(amount * 100) / 100 }
}

export function recurringRevenue(clients) {
  let annualCents = 0
  let recurringClients = 0
  for (const client of clients) {
    const cycle = Object.hasOwn(BILLING_CYCLES, client.billingCycle) ? BILLING_CYCLES[client.billingCycle] : null
    const amount = Number(client.billingAmount)
    if (client.status !== 'active' || !cycle?.months || !Number.isFinite(amount) || amount <= 0) continue
    annualCents += Math.round(amount * 100) * (12 / cycle.months)
    recurringClients++
  }
  // Sum annual cents first so monthly rounding never compounds per client.
  return { mrr: Math.round(annualCents / 12) / 100, arr: annualCents / 100, recurringClients }
}
