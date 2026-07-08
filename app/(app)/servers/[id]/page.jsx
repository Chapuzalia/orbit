'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { ServerMetricChart } from '@/components/charts'
import { useAppData } from '@/lib/data-context'
import { relativeTime } from '@/lib/format'
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  HardDrive,
  Gauge as GaugeIcon,
  Container,
  Globe,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'

function Stat({ icon: Icon, label, value, tone = 'text-foreground' }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

export default function ServerDetailPage({ params }) {
  const { id } = use(params)
  const { getServer, getServerMetrics } = useAppData()
  const server = getServer(id)
  if (!server) notFound()

  const history = getServerMetrics(server.id)
  const usageTone = (v) => (v >= 90 ? 'text-destructive' : v >= 75 ? 'text-warning' : 'text-success')
  const sslExpiringSoon = server.sslExpiry && new Date(server.sslExpiry) < new Date(Date.now() + 30 * 864e5)

  return (
    <div className="space-y-6">
      <Link href="/servers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Servidores
      </Link>

      <PageHeader
        title={<span className="font-mono">{server.name}</span>}
        description={`${server.provider || 'Sin proveedor'} - ${server.location || 'Sin ubicacion'} - ${server.os || 'SO no indicado'}`}
        actions={<StatusBadge type="server" value={server.status} dot />}
      />

      {server.status === 'critical' && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Servidor en estado critico</p>
            <p className="text-destructive/80">
              Uso de recursos por encima del umbral seguro. Revisa CPU, RAM, disco y carga del sistema.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Cpu} label="CPU" value={`${server.cpu}%`} tone={usageTone(server.cpu)} />
        <Stat icon={MemoryStick} label="RAM" value={`${server.ram}%`} tone={usageTone(server.ram)} />
        <Stat icon={HardDrive} label="SSD" value={`${server.disk}%`} tone={usageTone(server.disk)} />
        <Stat icon={GaugeIcon} label="Carga" value={server.load} tone={usageTone(server.load * 12)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Metricas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {server.status === 'offline' ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sin datos: servidor sin conexion.</p>
            ) : history.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sin historial: instala el agente de monitorizacion en este servidor.</p>
            ) : (
              <ServerMetricChart data={history} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">IP</span>
                <span className="font-mono">{server.ip || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span>{server.uptime || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latencia</span>
                <span className="tabular-nums">{server.latency} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contenedores</span>
                <span className="tabular-nums">{server.docker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Incidencias</span>
                <span className="tabular-nums">{server.incidents}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Ultima comprobacion</span>
                <span>{server.lastCheck ? relativeTime(server.lastCheck) : '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {sslExpiringSoon || server.ssl === 'expired' ? (
                  <ShieldAlert className="h-4 w-4 text-warning" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-success" />
                )}
                Certificado SSL
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {server.ssl === 'n/a' ? (
                <p className="text-muted-foreground">No aplica a este servidor.</p>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="capitalize">{server.ssl === 'valid' ? 'Valido' : 'Expirado'}</span>
                  <span className={sslExpiringSoon ? 'text-warning' : 'text-muted-foreground'}>
                    {server.sslExpiry ? relativeTime(server.sslExpiry) : '-'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Container className="h-4 w-4" />
              Servicios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {server.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin servicios activos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {server.services.map((svc) => (
                  <Badge key={svc} tone="primary" className="font-mono">
                    {svc}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Dominios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {server.domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin dominios asociados.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {server.domains.map((d) => (
                  <li key={d} className="flex items-center gap-2 font-mono text-primary">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
