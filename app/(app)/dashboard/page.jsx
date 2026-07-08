'use client'

import Link from 'next/link'
import {
  FolderKanban,
  ListChecks,
  AlertTriangle,
  Server,
  CreditCard,
  Calendar,
  GitPullRequest,
  ArrowUpRight,
  Activity as ActivityIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/status-badge'
import { RevenueAreaChart, StatusDonutChart } from '@/components/charts'
import { useAppData } from '@/lib/data-context'
import { PROJECT_STATUS } from '@/lib/constants'
import { formatCurrency, relativeTime, formatDateTime } from '@/lib/format'

export default function DashboardPage() {
  const {
    currentUser,
    dashboardMetrics,
    projects,
    activity,
    servers,
    meetings,
    pullRequests,
    invoices,
    revenueByMonth,
    getMember,
    getClient,
  } = useAppData()
  const activeProjects = projects
    .filter((p) => !['production', 'maintenance'].includes(p.status))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5)

  const statusData = Object.entries(
    projects.reduce((acc, p) => {
      const label = PROJECT_STATUS[p.status]?.label || p.status
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {}),
  ).map(([name, value]) => ({ name, value }))

  const upcomingMeetings = meetings
    .filter((m) => new Date(m.start) > new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 3)

  const openPRs = pullRequests.filter((pr) => pr.status !== 'merged').slice(0, 4)
  const pendingInvoices = invoices
    .filter((i) => ['overdue', 'pending', 'sent'].includes(i.status))
    .slice(0, 4)
  const criticalServers = servers.filter((s) =>
    ['warning', 'critical', 'offline'].includes(s.status),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Buenos dias, ${currentUser?.name?.split(' ')[0] || 'equipo'}`}
        description="Resumen general del workspace"
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Proyectos activos"
          value={dashboardMetrics.activeProjects}
          icon={FolderKanban}
          tone="primary"
          delta="+12%"
          hint="vs. mes anterior"
        />
        <MetricCard
          label="Tareas pendientes"
          value={dashboardMetrics.pendingTasks}
          icon={ListChecks}
          tone="info"
          sub={`${dashboardMetrics.overdueTasks} vencidas`}
        />
        <MetricCard
          label="Ingresos del mes"
          value={formatCurrency(dashboardMetrics.monthlyRevenue)}
          icon={CreditCard}
          tone="success"
          delta="+6%"
        />
        <MetricCard
          label="Servidores con incidencias"
          value={dashboardMetrics.serversWithIssues}
          icon={Server}
          tone="destructive"
          sub={`${servers.length} monitorizados`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Ingresos</CardTitle>
              <p className="text-sm text-muted-foreground">Facturación mensual y recurrente</p>
            </div>
            <Link
              href="/billing"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver facturación <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <RevenueAreaChart data={revenueByMonth} />
          </CardContent>
        </Card>

        {/* Status donut */}
        <Card>
          <CardHeader>
            <CardTitle>Proyectos por estado</CardTitle>
            <p className="text-sm text-muted-foreground">{projects.length} en total</p>
          </CardHeader>
          <CardContent>
            <StatusDonutChart data={statusData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Proyectos en curso</CardTitle>
            <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {activeProjects.map((p) => {
              const lead = getMember(p.leadId)
              const client = getClient(p.clientId)
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <StatusBadge type="project" value={p.status} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{client?.name}</p>
                  </div>
                  <div className="hidden w-40 items-center gap-3 sm:flex">
                    <Progress value={p.progress} className="flex-1" />
                    <span className="w-9 text-right text-sm tabular-nums text-muted-foreground">
                      {p.progress}%
                    </span>
                  </div>
                  <Avatar name={lead?.name} className="h-8 w-8 shrink-0" />
                </Link>
              )
            })}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-muted-foreground" /> Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {activity.slice(0, 6).map((a) => {
                const actor = a.actorId ? getMember(a.actorId) : null
                return (
                  <li key={a.id} className="flex gap-3">
                    {actor ? (
                      <Avatar name={actor.name} className="h-8 w-8 shrink-0" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight">
                        <span className="font-medium">{actor?.name || 'Sistema'}</span>{' '}
                        <span className="text-muted-foreground">{a.text}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                      <p className="text-xs text-muted-foreground/70">{relativeTime(a.createdAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Infra alerts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" /> Infraestructura
            </CardTitle>
            <Link href="/servers" className="text-sm font-medium text-primary hover:underline">
              Ver
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalServers.map((s) => (
              <Link
                key={s.id}
                href={`/servers/${s.id}`}
                className="block rounded-lg border border-border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{s.name}</span>
                  <StatusBadge type="server" value={s.status} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>CPU {s.cpu}%</span>
                  <span>RAM {s.ram}%</span>
                  <span>Disco {s.disk}%</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Open PRs */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-muted-foreground" /> Pull requests
            </CardTitle>
            <Link href="/github" className="text-sm font-medium text-primary hover:underline">
              Ver
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {openPRs.map((pr) => {
              const author = getMember(pr.authorId)
              return (
                <div key={pr.id} className="flex items-start gap-3">
                  <Avatar name={author?.name} className="h-7 w-7 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pr.title}</p>
                    <p className="text-xs text-muted-foreground">
                      #{pr.number} · {relativeTime(pr.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      pr.checks === 'passing' ? 'bg-success' : 'bg-destructive'
                    }`}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Meetings + invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Próximas reuniones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingMeetings.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(m.start)} · {m.location}
                </p>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Facturas pendientes
              </p>
              {pendingInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-muted-foreground">{getClient(inv.clientId)?.name}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(inv.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
