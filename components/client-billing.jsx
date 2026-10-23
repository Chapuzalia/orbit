'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { BILLING_CYCLES, MAX_BILLING_AMOUNT } from '@/lib/client-billing.mjs'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'

export function ClientBillingFields({ billingCycle, billingAmount, onChange, disabled = false, idPrefix }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cycle`}>Ciclo de facturación</Label>
        <Select id={`${idPrefix}-cycle`} value={billingCycle} disabled={disabled} onChange={(e) => onChange({ billingCycle: e.target.value, ...(e.target.value === 'none' ? { billingAmount: '' } : {}) })}>
          {Object.entries(BILLING_CYCLES).map(([value, cycle]) => <option key={value} value={value}>{cycle.label}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-amount`}>Importe por ciclo sin IVA (€)</Label>
        <Input id={`${idPrefix}-amount`} type="number" inputMode="decimal" min="0" max={MAX_BILLING_AMOUNT} step="0.01" required={billingCycle !== 'none'} disabled={disabled || billingCycle === 'none'} placeholder="0,00" value={billingAmount} onChange={(e) => onChange({ billingAmount: e.target.value })} aria-describedby={`${idPrefix}-hint`} />
        <p id={`${idPrefix}-hint`} className="text-xs text-muted-foreground">{billingCycle === 'none' ? 'Selecciona un ciclo para indicar el importe.' : billingCycle === 'one_time' ? 'Cobro único. No se incluye en MRR ni ARR.' : 'Importe total a facturar en cada ciclo.'}</p>
      </div>
    </>
  )
}

export function ClientBillingForm({ client }) {
  const { updateClientBilling } = useAppData()
  const { toast } = useToast()
  const [form, setForm] = useState({ billingCycle: client.billingCycle, billingAmount: client.billingCycle === 'none' ? '' : String(client.billingAmount) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = form.billingCycle !== client.billingCycle || Number(form.billingAmount || 0) !== client.billingAmount

  async function submit(e) {
    e.preventDefault()
    if (busy || !changed) return
    setBusy(true)
    setError('')
    try {
      await updateClientBilling(client.id, form)
      toast({ title: 'Facturación actualizada', description: client.name })
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ClientBillingFields {...form} idPrefix={`billing-${client.id}`} disabled={busy} onChange={(values) => setForm((prev) => ({ ...prev, ...values }))} />
      </div>
      <p className="text-xs text-muted-foreground">Los importes recurrentes de clientes activos se incluyen en el MRR y el ARR.</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !changed}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar facturación
      </Button>
    </form>
  )
}
