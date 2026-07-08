'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { formatCurrency, formatDate, relativeTime } from '@/lib/format'
import { ArrowLeft, Mail, Phone, MapPin, FileText, Building2 } from 'lucide-react'

export default function ClientDetailPage({ params }) {
  const { id } = use(params)
  const { getClient, projects, invoices, meetings } = useAppData()
  const client = getClient(id)
  if (!client) return notFound()

  const clientProjects = projects.filter((p) => p.clientId === id)
  const clientInvoices = invoices.filter((i) => i.clientId === id)
  const clientMeetings = meetings.filter((m) => m.clientId === id)

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={client.name} color={client.color} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{client.name}</h1>
              <StatusBadge type="client" value={client.status} />
            </div>
            <p className="text-sm text-muted-foreground">{client.legalName} · {client.taxId}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={Building2} label="Contacto" value={client.contact} />
              <Row icon={Mail} label="Email" value={client.email} />
              <Row icon={Phone} label="Teléfono" value={client.phone} />
              <Row icon={MapPin} label="Dirección" value={client.address} />
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                Último contacto {relativeTime(client.lastContact)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen financiero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Facturación total</span>
                <span className="font-semibold">{formatCurrency(client.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendiente de cobro</span>
                <span className={`font-semibold ${client.pending > 0 ? 'text-warning-foreground dark:text-warning' : ''}`}>
                  {formatCurrency(client.pending)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proyectos completados</span>
                <span className="font-medium">{client.completedProjects}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Proyectos ({clientProjects.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clientProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin proyectos.</p>
              ) : (
                clientProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary/40"
                  >
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(p.budget)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={p.progress} className="w-20" />
                      <StatusBadge type="project" value={p.status} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Facturas ({clientInvoices.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clientInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin facturas.</p>
              ) : (
                clientInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{inv.id}</div>
                      <div className="truncate text-xs text-muted-foreground">{inv.concept}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(inv.amount)}</div>
                      <StatusBadge type="invoice" value={inv.status} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {clientMeetings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reuniones ({clientMeetings.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {clientMeetings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <div className="text-sm font-medium">{m.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(m.start)} · {m.location}</div>
                    </div>
                    <StatusBadge type="meeting" value={m.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-medium text-card-foreground">{value}</div>
      </div>
    </div>
  )
}
