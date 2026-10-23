'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { EXPENSE_CATEGORIES, EXPENSE_CYCLES, VAT_OPTIONS, expenseAmounts } from '@/lib/expenses.mjs'
import { MAX_BILLING_AMOUNT } from '@/lib/client-billing.mjs'
import { formatCurrencyPrecise } from '@/lib/format'

export function ExpenseModal({ expense, onClose }) {
  const { createExpense, updateExpense } = useAppData()
  const { toast } = useToast()
  const [form, setForm] = useState({ name: expense?.name || '', supplier: expense?.supplier || '', category: expense?.category || 'software',
    netAmount: expense ? String(expense.netAmount) : '', vatType: expense?.vatType || 'rate', vatRate: expense ? String(expense.vatRate) : '21',
    billingCycle: expense?.billingCycle || 'monthly', status: expense?.status || 'active', chargeDate: expense?.chargeDate || '', notes: expense?.notes || '' })
  const [vatOption, setVatOption] = useState(expense && expense.vatType !== 'rate' ? expense.vatType : [0, 4, 10, 21].includes(expense?.vatRate ?? 21) ? String(expense?.vatRate ?? 21) : 'custom')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const close = () => { if (!busy) onClose() }
  const preview = expenseAmounts(form)

  function changeVat(value) {
    setVatOption(value)
    const special = ['exempt', 'not_subject', 'reverse_charge'].includes(value)
    setForm((prev) => ({ ...prev, vatType: special ? value : 'rate', vatRate: special ? '0' : value === 'custom' ? '' : value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (expense) await updateExpense(expense.id, form)
      else await createExpense(form)
      toast({ title: expense ? 'Gasto actualizado' : 'Gasto creado', description: form.name.trim() })
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el gasto. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open size="lg" title={expense ? 'Editar gasto' : 'Nuevo gasto'} onClose={close}
      description="Indica el importe de cada cobro y el IVA que figura en la factura."
      footer={<><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" className="text-foreground dark:text-primary-foreground" form="expense-form" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{expense ? 'Guardar cambios' : 'Crear gasto'}</Button></>}>
      <form id="expense-form" onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="expense-name" label="Nombre del gasto *"><Input id="expense-name" autoFocus required maxLength={200} disabled={busy} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Licencia, hosting, asesoría…" /></Field>
          <Field id="expense-supplier" label="Proveedor"><Input id="expense-supplier" maxLength={200} disabled={busy} value={form.supplier} onChange={(e) => set('supplier', e.target.value)} /></Field>
          <Field id="expense-category" label="Categoría"><Select id="expense-category" disabled={busy} value={form.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field id="expense-status" label="Estado"><Select id="expense-status" disabled={busy} value={form.status} onChange={(e) => set('status', e.target.value)}><option value="active">Activo</option><option value="paused">Pausado</option></Select></Field>
          <Field id="expense-net" label="Importe por cobro sin IVA (€) *"><Input id="expense-net" type="number" inputMode="decimal" min="0" max={MAX_BILLING_AMOUNT} step="0.01" required disabled={busy} value={form.netAmount} onChange={(e) => set('netAmount', e.target.value)} placeholder="0,00" /></Field>
          <Field id="expense-vat" label="IVA"><Select id="expense-vat" disabled={busy} value={vatOption} onChange={(e) => changeVat(e.target.value)}>{VAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
          {vatOption === 'custom' && <Field id="expense-rate" label="Porcentaje de IVA (%) *"><Input id="expense-rate" type="number" inputMode="decimal" min="0" max="100" step="0.01" required disabled={busy} value={form.vatRate} onChange={(e) => set('vatRate', e.target.value)} /></Field>}
          <Field id="expense-cycle" label="Ciclo de cobro"><Select id="expense-cycle" disabled={busy} value={form.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}>{Object.entries(EXPENSE_CYCLES).map(([value, cycle]) => <option key={value} value={value}>{cycle.label}</option>)}</Select></Field>
          <Field id="expense-date" label={form.billingCycle === 'one_time' ? 'Fecha prevista de cobro' : 'Próximo cobro previsto'}><Input id="expense-date" type="date" disabled={busy} value={form.chargeDate} onChange={(e) => set('chargeDate', e.target.value)} aria-describedby="expense-date-hint" /><p id="expense-date-hint" className="text-xs text-muted-foreground">Opcional. Puedes actualizarla al editar el gasto.</p></Field>
        </div>
        <div className="rounded-lg bg-muted/50 p-4" aria-live="polite" aria-atomic="true">
          <dl className="grid gap-3 sm:grid-cols-3">
            {[['Base sin IVA', preview.net], ['IVA en factura', preview.vat], ['Total por cobro', preview.total]].map(([label, amount]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{Number.isFinite(amount) ? formatCurrencyPrecise(amount) : '—'}</dd></div>)}
          </dl>
          {form.vatType === 'reverse_charge' && <p className="mt-3 text-xs text-muted-foreground">El total refleja el pago al proveedor, sin autorrepercusión de IVA.</p>}
        </div>
        <Field id="expense-notes" label="Notas"><Textarea id="expense-notes" maxLength={5000} disabled={busy} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
    </Modal>
  )
}

function Field({ id, label, children }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}
