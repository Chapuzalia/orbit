'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/status-badge'
import { MetricCard } from '@/components/metric-card'
import { useAppData } from '@/lib/data-context'
import { CreateMemberModal } from '@/components/create-entity-modals'
import { Users, Clock, Briefcase, TrendingUp, UserPlus } from 'lucide-react'

export default function TeamPage() {
  const { team } = useAppData()
  const [createOpen, setCreateOpen] = useState(false)
  const totalCapacity = team.reduce((s, m) => s + m.capacity, 0)
  const totalLogged = team.reduce((s, m) => s + m.logged, 0)
  const avgUtil = totalCapacity ? Math.round((totalLogged / totalCapacity) * 100) : 0
  const overloaded = team.filter((m) => m.availability === 'overloaded').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipo"
        description={`${team.length} miembros - utilizacion media ${avgUtil}%`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Nuevo miembro
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Miembros" value={team.length} icon={Users} tone="primary" />
        <MetricCard label="Utilizacion media" value={`${avgUtil}%`} icon={TrendingUp} tone="chart2" />
        <MetricCard label="Horas registradas" value={`${totalLogged}h`} icon={Clock} tone="chart3" sub={`de ${totalCapacity}h`} />
        <MetricCard
          label="Sobrecargados"
          value={overloaded}
          icon={Briefcase}
          tone={overloaded > 0 ? 'destructive' : 'chart3'}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => {
          const util = m.capacity ? Math.round((m.logged / m.capacity) * 100) : 0
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} color={m.color} size="lg" />
                  <div className="min-w-0">
                    <Link href={`/team/${m.id}`} className="font-semibold hover:text-primary">
                      {m.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{m.title}</div>
                  </div>
                </div>
                <StatusBadge type="availability" value={m.availability} />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Carga semanal</span>
                  <span className="font-medium">{m.logged}/{m.capacity}h</span>
                </div>
                <Progress value={util} tone={util > 100 ? 'destructive' : util > 85 ? 'warning' : 'primary'} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted/50 py-2">
                  <div className="text-base font-semibold text-card-foreground">{m.projects}</div>
                  <div className="text-muted-foreground">Proyectos</div>
                </div>
                <div className="rounded-lg bg-muted/50 py-2">
                  <div className="text-base font-semibold text-card-foreground">{m.tasks}</div>
                  <div className="text-muted-foreground">Tareas</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1">
                {m.skills.map((s) => (
                  <span key={s} className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
      <CreateMemberModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
