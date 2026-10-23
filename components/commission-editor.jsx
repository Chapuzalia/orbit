'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'
import { COMMISSION_PLANS, commissionPeriod, commissionSummary, newCommission, validateCommission } from '@/lib/commissions.mjs'
import { formatCurrencyPrecise as currency, formatDate } from '@/lib/format'

export function CommissionEditor({ client, salesRep, onBack }) {
  const { commissions, saveCommission } = useAppData()
  const agreement = commissions.find((item) => item.clientId === client.id && item.salesRepId === salesRep.id)
  const [form, setForm] = useState(() => agreement || newCommission(client))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receiptsBusy, setReceiptsBusy] = useState(false)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { toast } = useToast()
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const summary = agreement ? commissionSummary(agreement) : null
  let preview = null
  try { preview = commissionSummary({ ...form, receipts: agreement?.receipts || [] }) } catch {}

  async function submit(e) {
    e.preventDefault()
    if (busy || receiptsBusy) return
    setBusy(true); setError('')
    try {
      const values = validateCommission({ ...form, receipts: agreement?.receipts || [] })
      const saved = await saveCommission(agreement, client.id, salesRep.id, values)
      setForm(saved)
      toast({ title: 'Acuerdo de comisión guardado', description: client.name })
    } catch (err) { setError(err.message || 'No se pudo guardar el acuerdo.') }
    finally { setBusy(false) }
  }

  return <div className="space-y-6 [--muted-foreground:#5b6b80] dark:[--muted-foreground:#94a3b8]">
    <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" />Volver a Comerciales</Button>
    <PageHeader title={`Comisiones · ${client.name}`} description={`Comercial: ${salesRep.name}`} />
    <p className="max-w-3xl text-sm text-muted-foreground">Plan Tickit POS: bono de 1 cuota (0,5 en Basic) tras cobrar las dos primeras mensualidades; 10 % del mes 3 al 60. El bono se revierte si hay baja o impago antes de cobrar la cuarta cuota. Puedes adaptar las condiciones de este cliente.</p>
    {client.salesRepId !== salesRep.id && <p role="status" className="rounded-lg bg-muted p-3 text-sm">Este cliente ya no está asignado a {salesRep.name}. El acuerdo conserva sus cobros e importes; revisa su estado si ha terminado.</p>}
    <Card className="p-4 sm:p-6">
      <h2 className="text-base font-semibold">Condiciones por cliente</h2>
      <p className="mt-1 text-sm text-muted-foreground">Las condiciones se guardan en este acuerdo. Editarlas recalcula también sus comisiones anteriores.</p>
      <form onSubmit={submit} className="mt-5 space-y-5" aria-busy={busy}>
        <fieldset disabled={busy || receiptsBusy} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Plan del cliente" id="commission-plan"><Select id="commission-plan" value={form.plan} onChange={(e) => setForm((v) => ({ ...v, plan: e.target.value, bonusMultiplier: e.target.value === 'basic' ? 0.5 : e.target.value === 'custom' ? v.bonusMultiplier : 1 }))}>{Object.entries(COMMISSION_PLANS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
          <Field label="Cuota mensual de software sin IVA (€)" id="commission-amount"><Input id="commission-amount" type="number" min="0" max="999999999.99" step="0.01" required value={form.monthlyAmount} onChange={(e) => set('monthlyAmount', e.target.value)} /></Field>
          <Field label="Mes de la primera cuota" id="commission-start"><Input id="commission-start" type="month" min="2000-01" required value={form.startMonth} onChange={(e) => set('startMonth', e.target.value)} /></Field>
          <Field label="Bono de alta (número de cuotas)" id="commission-bonus"><Input id="commission-bonus" type="number" min="0" max="10" step="0.01" required value={form.bonusMultiplier} onChange={(e) => set('bonusMultiplier', e.target.value)} /></Field>
          <Field label="Comisión recurrente (%)" id="commission-rate"><Input id="commission-rate" type="number" min="0" max="100" step="0.01" required value={form.rate} onChange={(e) => set('rate', e.target.value)} /></Field>
          <Field label="Primer mes con comisión" id="commission-first"><Input id="commission-first" type="number" min="1" max="120" step="1" required value={form.firstMonth} onChange={(e) => set('firstMonth', e.target.value)} /></Field>
          <Field label="Último mes con comisión" id="commission-last"><Input id="commission-last" type="number" min={form.firstMonth || 1} max="120" step="1" required value={form.lastMonth} onChange={(e) => set('lastMonth', e.target.value)} /></Field>
          <Field label="Estado del acuerdo" id="commission-status"><Select id="commission-status" value={form.status} onChange={(e) => set('status', e.target.value)}><option value="active">Activo</option><option value="ended">Finalizado por baja o impago</option></Select></Field>
          {form.status === 'ended' && <Field label="Último mes del acuerdo" id="commission-ended"><Input id="commission-ended" type="number" min="1" max="120" step="1" required value={form.endedMonth || ''} onChange={(e) => set('endedMonth', e.target.value)} /></Field>}
        </fieldset>
        <p className="text-xs text-muted-foreground">La cuota es una base mensual para estimar. Si el cliente factura por trimestre o año, revisa el prorrateo sugerido. Excluye siempre IVA, hardware e instalación.</p>
        {preview && form.status === 'active' && <div className="rounded-lg bg-muted/50 p-3 text-sm tabular-nums" role="status">Con cuota constante: bono {currency(preview.bonusEstimate)} + {currency(preview.monthlyEstimate)} por mensualidad del mes {form.firstMonth} al {form.lastMonth}. Potencial del acuerdo: <strong>{currency(preview.lifetimeEstimate)}</strong>, si todas esas cuotas se cobran.</div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || receiptsBusy} className="text-slate-950">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{agreement ? 'Guardar condiciones' : 'Crear acuerdo de comisión'}</Button>
      </form>
    </Card>
    {agreement ? <>
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Comisión generada por cobros registrados</h2>
        <dl className="mt-4 grid gap-4 tabular-nums sm:grid-cols-2 lg:grid-cols-4">
          <Amount label="Bono de alta generado" value={summary.bonus} /><Amount label="Comisión recurrente" value={summary.recurring} />
          <Amount label="Ajuste por devolución del bono" value={summary.clawback ? -summary.clawback : 0} /><Amount label="Total generado" value={summary.earned} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">{summary.receiptCount} {summary.receiptCount === 1 ? 'mensualidad cobrada registrada' : 'mensualidades cobradas registradas'}. {summary.clawback > 0 ? 'Bono revertido por cierre antes de cobrar la cuarta cuota.' : summary.bonusProtected ? 'Cuarta cuota cobrada: bono consolidado.' : 'El bono queda sujeto a devolución hasta cobrar la cuarta cuota.'} Estos importes no indican liquidaciones pagadas al comercial.</p>
      </Card>
      <CommissionReceipts key={agreement.id} agreement={agreement} disabled={busy} onBusyChange={setReceiptsBusy} save={async (receipts) => saveCommission(agreement, client.id, salesRep.id, { ...agreement, receipts })} />
    </> : <p className="text-sm text-muted-foreground">Guarda las condiciones para registrar las cuotas cobradas y calcular la comisión generada.</p>}
  </div>
}
function Field({ label, id, children }) { return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div> }
function Amount({ label, value }) { return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{currency(value)}</dd></div> }

function CommissionReceipts({ agreement, save, disabled, onBusyChange }) {
  const [month, setMonth] = useState('')
  const [amount, setAmount] = useState(String(agreement.monthlyAmount))
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { toast } = useToast()
  const used = new Set(agreement.receipts.map((r) => r.month))
  const maxMonth = agreement.status === 'ended' ? agreement.endedMonth : 120
  async function persist(receipts) {
    if (busy || disabled) return
    setBusy(true); onBusyChange(true); setError('')
    try { await save(receipts); toast({ title: 'Registro de cuotas actualizado' }); return true }
    catch (err) { setError(err.message || 'No se pudo guardar la cuota.'); return false }
    finally { setBusy(false); onBusyChange(false) }
  }
  async function add(e) {
    e.preventDefault()
    if (await persist([...agreement.receipts, { month: Number(month), amount: Number(amount), date }])) { setMonth(''); setDate('') }
  }
  return <Card className="p-4 sm:p-6">
    <h2 className="text-base font-semibold">Cuotas cobradas</h2>
    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Registra cada mensualidad íntegramente cobrada con su base de software sin IVA. Para cobros trimestrales o anuales, registra las mensualidades cubiertas por ese cobro. No se importan automáticamente desde facturas ni se generan gastos.</p>
    <form onSubmit={add} className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end" aria-busy={busy}>
      <div className="min-w-0 flex-1"><Field label="Mensualidad cubierta" id="receipt-month"><Select id="receipt-month" value={month} onChange={(e) => setMonth(e.target.value)} required disabled={busy || disabled}><option value="">Selecciona un mes</option>{Array.from({length: maxMonth}, (_, i) => i + 1).filter((m) => !used.has(m)).map((m) => <option key={m} value={m}>Mes {m} · {commissionPeriod(agreement.startMonth, m)}</option>)}</Select></Field></div>
      <div className="min-w-0 flex-1"><Field label="Software cobrado sin IVA (€)" id="receipt-amount"><Input id="receipt-amount" type="number" min="0.01" max="999999999.99" step="0.01" required value={amount} disabled={busy || disabled} onChange={(e) => setAmount(e.target.value)} /></Field></div>
      <div className="min-w-0 flex-1"><Field label="Fecha de cobro" id="receipt-date"><Input id="receipt-date" type="date" min={`${agreement.startMonth}-01`} required value={date} disabled={busy || disabled} onChange={(e) => setDate(e.target.value)} /></Field></div>
      <Button type="submit" variant="outline" disabled={busy || disabled || !month}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Registrar cuota</Button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {agreement.receipts.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">Sin cuotas cobradas registradas. Aún no se ha generado ninguna comisión.</p> : <div className="mt-6 overflow-x-auto"><table className="relative w-full min-w-[540px] text-left text-sm tabular-nums"><caption className="sr-only">Mensualidades cobradas y comisión recurrente de este acuerdo</caption><thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="pb-3 font-medium">Mensualidad</th><th scope="col" className="pb-3 font-medium">Cobro</th><th scope="col" className="pb-3 text-right font-medium">Base sin IVA</th><th scope="col" className="pb-3 text-right font-medium">Comisión recurrente</th><th scope="col" className="pb-3"><span className="sr-only">Corregir</span></th></tr></thead><tbody>{agreement.receipts.map((r) => <tr key={r.month} className="border-b border-border last:border-0"><th scope="row" className="py-3 font-medium">Mes {r.month} · {commissionPeriod(agreement.startMonth, r.month)}</th><td className="py-3">{formatDate(`${r.date}T12:00:00Z`)}</td><td className="py-3 text-right">{currency(r.amount)}</td><td className="py-3 text-right">{currency(r.month >= agreement.firstMonth && r.month <= agreement.lastMonth ? commissionSummary({ ...agreement, receipts: [r] }).recurring : 0)}</td><td className="py-3 text-right"><Button variant="ghost" size="icon" disabled={busy || disabled} aria-label={`Retirar registro del mes ${r.month}`} title="Retirar registro para corregirlo" onClick={() => persist(agreement.receipts.filter((item) => item.month !== r.month))}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}
    <p className="mt-4 text-xs text-muted-foreground">El bono se calcula con la base cobrada de la segunda mensualidad. Puedes retirar una cuota incorrecta y volver a registrarla; el resumen se recalcula.</p>
  </Card>
}
