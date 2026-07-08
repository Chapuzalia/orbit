'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { MetricCard } from '@/components/metric-card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RevenueAreaChart } from '@/components/charts'
import { useAppData } from '@/lib/data-context'
import { formatCurrency, formatDate } from '@/lib/format'
import { useToast } from '@/components/ui/toaster'
import { Wallet, TrendingUp, Clock, RefreshCw, Download, Plus } from 'lucide-react'

export default function BillingPage() {
  const { toast } = useToast()
  const { invoices, payments, subscriptions, getClient, revenueByMonth } = useAppData()
  const [tab, setTab] = useState('invoices')

  const totalBilled = invoices.reduce((s, i) => s + i.amount, 0)
  const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const pending = invoices.filter((i) => ['pending', 'sent'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const overdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const mrr = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (s.interval === 'year' ? s.amount / 12 : s.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Facturas, pagos y suscripciones"
        actions={
          <>
            <Button variant="outline" onClick={() => toast({ title: 'Exportando', description: 'El informe se está generando.' })}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={() => toast({ title: 'Nueva factura', description: 'Disponible al conectar Stripe.' })}>
              <Plus className="h-4 w-4" />
              Nueva factura
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cobrado" value={formatCurrency(paid)} icon={Wallet} tone="chart3" />
        <MetricCard label="MRR" value={formatCurrency(Math.round(mrr))} icon={TrendingUp} tone="primary" delta="+8%" />
        <MetricCard label="Pendiente" value={formatCurrency(pending)} icon={Clock} tone="chart2" />
        <MetricCard label="Vencido" value={formatCurrency(overdue)} icon={RefreshCw} tone={overdue > 0 ? 'destructive' : 'chart3'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingresos por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueAreaChart data={revenueByMonth} />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="invoices">Facturas ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Pagos ({payments.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">Suscripciones ({subscriptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Cliente</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Emitida</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Vence</th>
                    <th className="px-4 py-3 font-medium">Importe</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{inv.id}</div>
                        <div className="text-xs text-muted-foreground">{inv.concept}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{getClient(inv.clientId)?.name}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(inv.issued)}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(inv.due)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge type="invoice" value={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Método</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Factura</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Fecha</th>
                    <th className="px-4 py-3 font-medium">Importe</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-3 font-medium">{getClient(p.clientId)?.name}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.method}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.invoiceId || '—'}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(p.date)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge type="invoice" value={p.status === 'succeeded' ? 'paid' : p.status === 'refunded' ? 'overdue' : 'pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="grid gap-4 sm:grid-cols-2">
            {subscriptions.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{s.plan}</div>
                    <div className="text-xs text-muted-foreground">{getClient(s.clientId)?.name}</div>
                  </div>
                  <StatusBadge type="invoice" value={s.status === 'active' ? 'paid' : 'overdue'} />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span className="text-2xl font-semibold">{formatCurrency(s.amount)}</span>
                    <span className="text-sm text-muted-foreground">/{s.interval === 'year' ? 'año' : 'mes'}</span>
                  </div>
                  {s.nextInvoice && (
                    <div className="text-right text-xs text-muted-foreground">
                      Próxima factura
                      <div className="font-medium text-card-foreground">{formatDate(s.nextInvoice)}</div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
