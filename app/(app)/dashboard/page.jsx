'use client'

import Link from 'next/link'
import { Building2, CreditCard, FileText, Server, Activity } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { RevenueAreaChart } from '@/components/charts'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { formatCurrency, relativeTime } from '@/lib/format'

export default function DashboardPage() {
  const { currentUser, dashboardMetrics, servers, invoices, activity, revenueByMonth, getClient } = useAppData()
  const issues = servers.filter((server) => ['warning', 'critical', 'offline'].includes(server.status))
  const pending = invoices.filter((invoice) => ['pending', 'overdue', 'sent'].includes(invoice.status))
  return (
    <div className="space-y-6">
      <PageHeader title={`Buenos dias, ${currentUser?.name?.split(' ')[0] || 'Usuario'}`} description="Clientes, facturacion e infraestructura" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Clientes activos" value={dashboardMetrics.activeClients} icon={Building2} tone="primary" />
        <MetricCard label="Ingresos del mes" value={formatCurrency(dashboardMetrics.monthlyRevenue)} icon={CreditCard} tone="success" />
        <MetricCard label="Facturas pendientes" value={dashboardMetrics.pendingInvoices} icon={FileText} tone="warning" />
        <MetricCard label="Servidores con incidencias" value={dashboardMetrics.serversWithIssues} icon={Server} tone="destructive" sub={`${servers.length} monitorizados`} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ingresos mensuales y recurrentes</CardTitle>
          <Link href="/billing" className="text-sm text-primary hover:underline">Ver facturacion</Link>
        </CardHeader>
        <CardContent><RevenueAreaChart data={revenueByMonth} /></CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Infraestructura</CardTitle>
            <Link href="/servers" className="text-sm text-primary hover:underline">Ver servidores</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {issues.length === 0 && <p className="text-sm text-muted-foreground">Sin incidencias.</p>}
            {issues.map((server) => (
              <Link key={server.id} href={`/servers/${server.id}`} className="block rounded-lg border border-border p-3 hover:bg-accent">
                <div className="flex justify-between gap-3"><span className="font-mono text-sm">{server.name}</span><StatusBadge type="server" value={server.status} /></div>
                <p className="mt-2 text-xs text-muted-foreground">CPU {server.cpu}% · RAM {server.ram}% · Disco {server.disk}%</p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Facturas pendientes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Sin facturas pendientes.</p>}
            {pending.slice(0, 6).map((invoice) => (
              <div key={invoice.id} className="flex justify-between gap-3 text-sm">
                <div><p className="font-medium">{getClient(invoice.clientId)?.name || invoice.number || invoice.id}</p><p className="text-xs text-muted-foreground">{invoice.concept}</p></div>
                <span>{formatCurrency(invoice.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Actividad reciente</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 && <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>}
          <ul className="space-y-3">{activity.slice(0, 6).map((entry) => (
            <li key={entry.id}><p className="text-sm">{entry.text}</p><p className="text-xs text-muted-foreground">{entry.detail} · {relativeTime(entry.createdAt)}</p></li>
          ))}</ul>
        </CardContent>
      </Card>
    </div>
  )
}
