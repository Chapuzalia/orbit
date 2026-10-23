'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'

export function SalesRepModal({ salesRep, onClose }) {
  const { createSalesRep, updateSalesRep } = useAppData()
  const { toast } = useToast()
  const [form, setForm] = useState({ name: salesRep?.name || '', email: salesRep?.email || '', phone: salesRep?.phone || '', notes: salesRep?.notes || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => { if (!busy) onClose() }
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))
      if (salesRep) await updateSalesRep(salesRep.id, values)
      else await createSalesRep(values)
      toast({ title: salesRep ? 'Comercial actualizado' : 'Comercial creado', description: values.name })
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={close} title={salesRep ? 'Editar comercial' : 'Nuevo comercial'} description="Guarda sus datos de contacto. Puedes asignarle clientes después."
      footer={<><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" form="sales-rep-form" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{salesRep ? 'Guardar cambios' : 'Crear comercial'}</Button></>}>
      <form id="sales-rep-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="rep-name">Nombre <span className="text-destructive">*</span></Label><Input id="rep-name" autoFocus required maxLength={200} value={form.name} onChange={(e) => set('name', e.target.value)} disabled={busy} /></div>
        <div className="space-y-1.5"><Label htmlFor="rep-email">Email</Label><Input id="rep-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={busy} /></div>
        <div className="space-y-1.5"><Label htmlFor="rep-phone">Teléfono</Label><Input id="rep-phone" type="tel" maxLength={100} value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={busy} /></div>
        <div className="space-y-1.5"><Label htmlFor="rep-notes">Notas</Label><Textarea id="rep-notes" maxLength={5000} value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={busy} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
    </Modal>
  )
}
