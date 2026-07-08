'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { CreateServerModal } from '@/components/create-entity-modals'
import { Server, Cpu, MemoryStick, HardDrive, Activity, ShieldCheck, ShieldAlert, Plus } from 'lucide-react'

function Gauge({ label, value, icon: Icon }) {
  const tone = value >= 90 ? 'text-destructive' : value >= 75 ? 'text-warning' : 'text-success'
  const barTone = value >= 90 ? 'bg-destructive' : value >= 75 ? 'bg-warning' : 'bg-success'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className={`font-semibold tabular-nums ${tone}`}>{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function ServersPage() {
  const { servers } = useAppData()
  const [createOpen, setCreateOpen] = useState(false)
  const operational = servers.filter((s) => s.status === 'operational').length
  const issues = servers.filter((s) => ['warning', 'critical'].includes(s.status)).length
  const offline = servers.filter((s) => s.status === 'offline').length
  const expiringSSL = servers.filter((s) => s.ssl === 'valid' && s.sslExpiry && new Date(s.sslExpiry) < new Date(Date.now() + 30 * 864e5)).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servidores"
        description={`${servers.length} servidores - ${operational} operativos - ${issues} con incidencias`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo servidor
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{operational}</p>
              <p className="text-xs text-muted-foreground">Operativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{issues}</p>
              <p className="text-xs text-muted-foreground">Con incidencias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{offline}</p>
              <p className="text-xs text-muted-foreground">Sin conexion</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${expiringSSL > 0 ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{expiringSSL}</p>
              <p className="text-xs text-muted-foreground">SSL por vencer</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {servers.map((s) => (
          <Link key={s.id} href={`/servers/${s.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.provider || 'Sin proveedor'} - {s.location || 'Sin ubicacion'}
                    </p>
                  </div>
                  <StatusBadge type="server" value={s.status} dot />
                </div>

                {s.status === 'offline' ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Servidor sin conexion</p>
                ) : (
                  <div className="space-y-2.5">
                    <Gauge label="CPU" value={s.cpu} icon={Cpu} />
                    <Gauge label="RAM" value={s.ram} icon={MemoryStick} />
                    <Gauge label="SSD" value={s.disk} icon={HardDrive} />
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="font-mono">{s.ip || '-'}</span>
                  <span>Uptime {s.uptime || '-'}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <CreateServerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
