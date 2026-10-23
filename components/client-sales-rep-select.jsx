'use client'

import { useState } from 'react'
import { Select, Label } from '@/components/ui/input'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'

export function ClientSalesRepSelect({ client }) {
  const { salesReps, assignClientSalesRep } = useAppData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function assign(salesRepId) {
    setBusy(true)
    try {
      await assignClientSalesRep(client.id, salesRepId)
      toast({ title: salesRepId ? 'Comercial asignado' : 'Asignación eliminada', description: client.name })
    } catch (err) {
      toast({ title: 'No se pudo cambiar el comercial', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`sales-rep-${client.id}`}>Comercial asignado</Label>
      <Select id={`sales-rep-${client.id}`} value={client.salesRepId} disabled={busy} onChange={(e) => assign(e.target.value)} aria-busy={busy}>
        <option value="">Sin comercial</option>
        {salesReps.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
      </Select>
      <p className="text-xs text-muted-foreground" role="status">{busy ? 'Guardando asignación…' : 'Puedes cambiarlo o dejar el cliente sin comercial.'}</p>
    </div>
  )
}
