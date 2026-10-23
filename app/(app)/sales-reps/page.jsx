'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Loader2, Pencil, Plus, Search, Trash2, UserMinus, Users } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { SalesRepModal } from '@/components/sales-rep-modal'
import { CommissionEditor } from '@/components/commission-editor'
import { commissionSummary } from '@/lib/commissions.mjs'
import { formatCurrencyPrecise as currency } from '@/lib/format'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'

export default function SalesRepsPage() {
  const { salesReps, clients, commissions, deleteSalesRep, assignClientSalesRep } = useAppData()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [commissionEditor, setCommissionEditor] = useState(null)
  const [expanded, setExpanded] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const unassigned = clients.filter((client) => !client.salesRepId)
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es')
    return salesReps.filter((rep) => [rep.name, rep.email, rep.phone].some((value) => value?.toLocaleLowerCase('es').includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [salesReps, query])

  async function remove() {
    if (busy) return
    setBusy(true)
    setDeleteError('')
    try {
      await deleteSalesRep(deleting.id)
      toast({ title: 'Comercial eliminado', description: 'Sus clientes quedan sin comercial asignado.' })
      setDeleting(null)
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (commissionEditor) {
    const client = clients.find((item) => item.id === commissionEditor.clientId)
    const rep = salesReps.find((item) => item.id === commissionEditor.repId)
    if (client && rep) return <CommissionEditor key={`${client.id}-${rep.id}`} client={client} salesRep={rep} onBack={() => setCommissionEditor(null)} />
  }

  return (
    <div className="space-y-6 [--muted-foreground:#5b6b80] dark:[--muted-foreground:#94a3b8]">
      <PageHeader title="Comerciales" description={`${salesReps.length} ${salesReps.length === 1 ? 'comercial' : 'comerciales'} · ${unassigned.length} ${unassigned.length === 1 ? 'cliente sin comercial' : 'clientes sin comercial'}`}
        actions={<Button onClick={() => setEditor({})}><Plus className="h-4 w-4" />Nuevo comercial</Button>} />
      <p className="max-w-3xl text-sm text-muted-foreground">Configura la comisión de cada cliente desde su cartera: bono de alta y porcentaje recurrente según el plan Tickit POS. Los importes generados se calculan solo con cuotas cobradas registradas, sin IVA.</p>
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar comerciales" placeholder="Buscar por nombre, email o teléfono…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={salesReps.length ? 'Sin resultados' : 'Todavía no hay comerciales'} description={salesReps.length ? 'Prueba con otro nombre, email o teléfono.' : 'Crea el primer comercial y asígnale clientes cuando lo necesites.'} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {filtered.map((rep) => {
            const assigned = clients.filter((client) => client.salesRepId === rep.id)
            const isOpen = expanded === rep.id
            const agreements = commissions.filter((item) => item.salesRepId === rep.id)
            const earned = agreements.reduce((sum, item) => sum + Math.round(commissionSummary(item).earned * 100), 0) / 100
            return (
              <div key={rep.id}>
                <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                  <Avatar name={rep.name} size="md" />
                  <div className="min-w-0 flex-1 basis-32">
                    <h2 className="break-words font-semibold">{rep.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {rep.email && <a className="break-all hover:text-foreground hover:underline" href={`mailto:${rep.email}`}>{rep.email}</a>}
                      {rep.phone && <a className="hover:text-foreground hover:underline" href={`tel:${rep.phone}`}>{rep.phone}</a>}
                      {!rep.email && !rep.phone && <span>Sin datos de contacto</span>}
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <span className="mr-2 text-sm tabular-nums">{currency(earned)} <span className="text-muted-foreground">generados</span></span>
                    <Button variant="outline" aria-expanded={isOpen} aria-controls={`clients-${rep.id}`} onClick={() => setExpanded(isOpen ? '' : rep.id)}>
                      {assigned.length} {assigned.length === 1 ? 'cliente' : 'clientes'}<ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Editar ${rep.name}`} onClick={() => setEditor(rep)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={agreements.length > 0} title={agreements.length ? 'Conserva sus acuerdos de comisión: no se puede eliminar este comercial.' : undefined} aria-label={`Eliminar ${rep.name}`} onClick={() => { setDeleteError(''); setDeleting(rep) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {isOpen && <div id={`clients-${rep.id}`} className="space-y-4 border-t border-border bg-muted/30 p-4 sm:p-5">
                  {rep.notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{rep.notes}</p>}
                  <ClientPortfolio salesRep={rep} assigned={assigned} unassigned={unassigned} assign={assignClientSalesRep} agreements={agreements} clients={clients} onCommission={(client) => setCommissionEditor({ clientId: client.id, repId: rep.id })} />
                </div>}
              </div>
            )
          })}
        </Card>
      )}
      {editor && <SalesRepModal key={editor.id || 'new'} salesRep={editor.id ? editor : null} onClose={() => setEditor(null)} />}
      {deleting && <Modal open title={`Eliminar a ${deleting.name}`} onClose={() => { if (!busy) setDeleting(null) }}
        description={`Se eliminará este comercial. Sus ${clients.filter((client) => client.salesRepId === deleting.id).length} clientes se conservarán y quedarán sin comercial asignado.`}
        footer={<><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Eliminar comercial</Button></>}>
        <p className="text-sm text-muted-foreground">Podrás asignar esos clientes a otro comercial.</p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-destructive">{deleteError}</p>}
      </Modal>}
    </div>
  )
}

function ClientPortfolio({ salesRep, assigned, unassigned, assign, agreements, clients, onCommission }) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(id, repId) {
    setBusy(true)
    try {
      await assign(id, repId)
      setClientId('')
      toast({ title: repId ? 'Cliente asignado' : 'Asignación eliminada' })
    } catch (err) {
      toast({ title: 'No se pudo cambiar la asignación', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" aria-busy={busy}>
      <h3 className="text-sm font-semibold">Clientes asignados</h3>
      {assigned.length === 0 ? <p className="text-sm text-muted-foreground">Este comercial todavía no tiene clientes asignados.</p> : (
        <ul className="divide-y divide-border">
          {assigned.map((client) => <li key={client.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1 basis-40">
              <Link className="break-words text-sm font-medium hover:text-primary hover:underline" href={`/clients/${client.id}`}>{client.name}</Link>
              {agreements.filter((item) => item.clientId === client.id).map((item) => <p key={item.id} className="mt-1 text-xs text-muted-foreground tabular-nums">{item.rate} % · {currency(commissionSummary(item).monthlyEstimate)} por cuota · meses {item.firstMonth}–{item.lastMonth} · {item.status === 'ended' ? 'Finalizado' : 'Activo'}</p>)}
            </div>
            <StatusBadge type="client" value={client.status} />
            <Button variant="outline" disabled={busy} onClick={() => onCommission(client)} aria-label={`Comisión de ${client.name}`}>{agreements.some((item) => item.clientId === client.id) ? 'Ver comisión' : 'Configurar comisión'}</Button>
            <Button variant="ghost" size="icon" disabled={busy} aria-label={`Quitar asignación de ${client.name}`} onClick={() => save(client.id, '')}><UserMinus className="h-4 w-4" /></Button>
          </li>)}
        </ul>
      )}
      {agreements.some((item) => !assigned.some((client) => client.id === item.clientId)) && <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Acuerdos de clientes reasignados</h3>
        <p className="text-xs text-muted-foreground">Conservan el comercial original y sus cobros. Cambiar la asignación no transfiere ni cierra el acuerdo.</p>
        {agreements.filter((item) => !assigned.some((client) => client.id === item.clientId)).map((item) => {
          const client = clients.find((client) => client.id === item.clientId)
          return client && <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><span>{client.name} · {item.status === 'ended' ? 'Finalizado' : 'Activo'}</span><Button variant="outline" onClick={() => onCommission(client)}>Ver comisión de {client.name}</Button></div>
        })}
      </div>}
      {agreements.length > 0 && <p className="text-xs text-muted-foreground">Este comercial tiene acuerdos de comisión y se conserva para mantener su historial. Los totales generados no son pagos al comercial.</p>}
      {unassigned.length > 0 ? <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (clientId && !busy) save(clientId, salesRep.id) }}>
        <Label htmlFor={`assign-${salesRep.id}`}>Asignar cliente sin comercial</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select id={`assign-${salesRep.id}`} value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={busy} required className="sm:max-w-sm">
            <option value="">Selecciona un cliente</option>
            {unassigned.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </Select>
          <Button type="submit" disabled={!clientId || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Asignar cliente</Button>
        </div>
      </form> : <p className="text-xs text-muted-foreground">No hay clientes sin comercial. Puedes cambiar su asignación desde la ficha de cada cliente.</p>}
    </div>
  )
}
