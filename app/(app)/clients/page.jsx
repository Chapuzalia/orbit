'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/status-badge'
import { MetricCard } from '@/components/metric-card'
import { EmptyState } from '@/components/empty-state'
import { useAppData } from '@/lib/data-context'
import { CreateClientModal } from '@/components/create-entity-modals'
import { CLIENT_STATUS } from '@/lib/constants'
import { formatCurrency, formatCurrencyPrecise, relativeTime } from '@/lib/format'
import { BILLING_CYCLES, recurringRevenue } from '@/lib/client-billing.mjs'
import { Search, Plus, Building2, Users, Wallet, AlertCircle } from 'lucide-react'

const FILTERS = [{ value: 'all', label: 'Todos' }, ...Object.entries(CLIENT_STATUS).map(([value, cfg]) => ({ value, label: cfg.label }))]

export default function ClientsPage() {
  const { clients, salesReps } = useAppData()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [salesRepId, setSalesRepId] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        const q = !query || c.name.toLowerCase().includes(query.toLowerCase()) || (c.contact || '').toLowerCase().includes(query.toLowerCase())
        const s = status === 'all' || c.status === status
        const r = salesRepId === 'all' || (salesRepId === 'unassigned' ? !c.salesRepId : c.salesRepId === salesRepId)
        return q && s && r
      }),
    [clients, query, status, salesRepId],
  )

  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0)
  const totalPending = clients.reduce((s, c) => s + c.pending, 0)
  const activeClients = clients.filter((c) => c.status === 'active').length
  const { mrr, arr, recurringClients } = recurringRevenue(clients)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={`${clients.length} clientes · ${activeClients} activos`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Clientes activos" value={activeClients} icon={Users} tone="primary" />
        <MetricCard label="Facturación total" value={formatCurrency(totalRevenue)} icon={Wallet} tone="chart3" />
        <MetricCard label="Pendiente de cobro" value={formatCurrency(totalPending)} icon={AlertCircle} tone="warning" />
        <MetricCard label="Empresas" value={clients.filter((c) => c.type === 'Empresa').length} icon={Building2} tone="chart2" />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Ingresos recurrentes</h2>
        <p className="mt-1 text-xs text-muted-foreground">Total de clientes activos · sin IVA · independiente de los filtros</p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">MRR · ingreso recurrente mensual</dt>
            <dd className="mt-1 break-words text-2xl font-semibold tabular-nums">{formatCurrencyPrecise(mrr)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">ARR · ingreso recurrente anual</dt>
            <dd className="mt-1 break-words text-2xl font-semibold tabular-nums">{formatCurrencyPrecise(arr)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          {recurringClients === 0 ? 'Configura el ciclo y el importe en la ficha de un cliente activo para calcular sus ingresos recurrentes.' : `${recurringClients} ${recurringClients === 1 ? 'cliente con facturación recurrente' : 'clientes con facturación recurrente'}. Los ciclos se convierten a su equivalente mensual. No incluye cobros puntuales.`}
        </p>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente o contacto..." className="pl-9" />
        </div>
        <Select aria-label="Filtrar clientes por comercial" value={salesRepId} onChange={(e) => setSalesRepId(e.target.value)} className="sm:max-w-52">
          <option value="all">Todos los comerciales</option>
          <option value="unassigned">Sin comercial</option>
          {salesReps.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                status === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Sin clientes" description="No hay clientes que coincidan con los filtros." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="group block min-w-0">
              <Card className="h-full p-5 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={c.name} color={c.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 title={c.name} className="truncate font-semibold group-hover:text-primary">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.type}</p>
                    </div>
                  </div>
                  <StatusBadge type="client" value={c.status} className="shrink-0" />
                </div>

                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Ciclo</span>
                    <span className="font-medium">{BILLING_CYCLES[c.billingCycle]?.label || 'Sin configurar'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Importe sin IVA</span>
                    <span className="font-medium tabular-nums">{c.billingCycle === 'none' ? '—' : formatCurrencyPrecise(c.billingAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Comercial</span>
                    <span className="truncate font-medium">{salesReps.find((rep) => rep.id === c.salesRepId)?.name || 'Sin comercial'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contacto</span>
                    <span className="font-medium">{c.contact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facturación</span>
                    <span className="font-medium">{formatCurrency(c.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pendiente</span>
                    <span className={`font-medium ${c.pending > 0 ? 'text-warning-foreground dark:text-warning' : ''}`}>
                      {formatCurrency(c.pending)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>Contacto {relativeTime(c.lastContact)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <CreateClientModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
