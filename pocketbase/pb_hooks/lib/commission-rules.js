// Shared by PocketBase hooks and the web app. Amounts are net software fees only.
function cents(value) { return Math.round((Number(value) + Number.EPSILON) * 100); }
function money(value, label, max) {
  const number = Number(value);
  if (value === '' || value == null || !Number.isFinite(number) || number < 0 || number > max || Math.abs(number * 100 - cents(number)) > 0.0001) throw new Error(label + ': introduce un número válido con hasta dos decimales.');
  return number;
}
function integer(value, label, min, max) {
  const number = Number(value);
  if (value === '' || value == null || !Number.isInteger(number) || number < min || number > max) throw new Error(label + ': introduce un entero entre ' + min + ' y ' + max + '.');
  return number;
}
function date(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
function validate(values) {
  if (!['basic', 'pro', 'business', 'custom'].includes(values.plan)) throw new Error('Selecciona un plan válido.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(values.startMonth || '') || Number(values.startMonth.slice(0, 4)) < 2000) throw new Error('Indica el mes de la primera cuota.');
  const monthlyAmount = money(values.monthlyAmount, 'Cuota mensual sin IVA', 999999999.99);
  const bonusMultiplier = money(values.bonusMultiplier, 'Bono en cuotas', 10);
  const rate = money(values.rate, 'Comisión (%)', 100);
  const firstMonth = integer(values.firstMonth, 'Primer mes con comisión', 1, 120);
  const lastMonth = integer(values.lastMonth, 'Último mes con comisión', firstMonth, 120);
  if (!['active', 'ended'].includes(values.status)) throw new Error('Selecciona el estado del acuerdo.');
  const endedMonth = values.status === 'ended' ? integer(values.endedMonth, 'Mes de baja o impago', 1, 120) : 0;
  if (!Array.isArray(values.receipts) || values.receipts.length > 120) throw new Error('El registro de cuotas no es válido.');
  const seen = {};
  const receipts = values.receipts.map(function (receipt) {
    const month = integer(receipt.month, 'Mes de la cuota', 1, 120);
    if (seen[month]) throw new Error('Cada mensualidad solo puede registrarse una vez.');
    seen[month] = true;
    const amount = money(receipt.amount, 'Cuota cobrada sin IVA', 999999999.99);
    if (amount <= 0) throw new Error('La cuota cobrada debe ser mayor que cero.');
    if (!date(receipt.date)) throw new Error('Indica una fecha de cobro válida.');
    if (receipt.date.slice(0, 7) < values.startMonth) throw new Error('El cobro no puede ser anterior al inicio del acuerdo.');
    if (values.status === 'ended' && month > endedMonth) throw new Error('Hay cuotas posteriores al mes de baja o impago. Corrige el registro o el mes de cierre.');
    return { month: month, amount: amount, date: receipt.date };
  }).sort(function (a, b) { return a.month - b.month; });
  return { plan: values.plan, startMonth: values.startMonth, monthlyAmount: monthlyAmount, bonusMultiplier: bonusMultiplier, rate: rate, firstMonth: firstMonth, lastMonth: lastMonth, status: values.status, endedMonth: endedMonth, receipts: receipts };
}
function calculate(values) {
  const v = validate(values);
  const first = v.receipts.find(function (r) { return r.month === 1; });
  const second = v.receipts.find(function (r) { return r.month === 2; });
  const fourth = v.receipts.find(function (r) { return r.month === 4; });
  const bonusCents = first && second ? Math.round(cents(second.amount) * v.bonusMultiplier) : 0;
  const clawbackCents = v.status === 'ended' && !fourth ? bonusCents : 0;
  const recurringCents = v.receipts.reduce(function (sum, r) { return sum + (r.month >= v.firstMonth && r.month <= v.lastMonth ? Math.round(cents(r.amount) * v.rate / 100) : 0); }, 0);
  const monthlyCents = Math.round(cents(v.monthlyAmount) * v.rate / 100);
  return { bonus: bonusCents / 100, clawback: clawbackCents / 100, recurring: recurringCents / 100, earned: (bonusCents + recurringCents - clawbackCents) / 100,
    monthlyEstimate: monthlyCents / 100, bonusEstimate: Math.round(cents(v.monthlyAmount) * v.bonusMultiplier) / 100,
    lifetimeEstimate: (Math.round(cents(v.monthlyAmount) * v.bonusMultiplier) + monthlyCents * (v.lastMonth - v.firstMonth + 1)) / 100,
    receiptCount: v.receipts.length, bonusProtected: !!fourth };
}
module.exports = { validate: validate, calculate: calculate };
