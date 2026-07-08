'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/status-badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { EditProjectModal } from '@/components/create-entity-modals'
import { useAppData } from '@/lib/data-context'
import { formatCurrency, formatDate, daysUntil } from '@/lib/format'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Wallet,
  Target,
  CheckSquare,
  GitBranch,
  AlertTriangle,
  ListChecks,
  Database,
  ExternalLink,
  Globe,
} from 'lucide-react'

const RISK_TONE = { low: 'success', medium: 'warning', high: 'destructive' }

export default function ProjectDetailPage({ params }) {
  const { id } = use(params)
  const { getProject, getClient, getMember, getTasks, getMilestones, repositories } = useAppData()
  const project = getProject(id)
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)

  if (!project) return notFound()

  const client = getClient(project.clientId)
  const lead = getMember(project.leadId)
  const members = project.memberIds.map(getMember).filter(Boolean)
  const projectTasks = getTasks(project.id)
  const milestones = getMilestones(project.id)
  const repo = repositories.find((r) => r.projectId === project.id)
  const assignedRepoName = project.githubRepoFullName || repo?.name || ''
  const assignedRepoUrl = assignedRepoName ? `https://github.com/${assignedRepoName}` : ''
  const days = daysUntil(project.dueDate)
  const hoursPct = project.estimatedHours > 0 ? Math.round((project.loggedHours / project.estimatedHours) * 100) : 0

  const stats = [
    { label: 'Presupuesto', value: formatCurrency(project.budget), icon: Wallet },
    { label: 'Horas', value: `${project.loggedHours} / ${project.estimatedHours}h`, icon: Clock },
    { label: 'Entrega', value: formatDate(project.dueDate), icon: Calendar },
    {
      label: 'Días restantes',
      value: days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`,
      icon: Target,
      tone: days < 0 ? 'text-destructive' : undefined,
    },
  ]
  const projectLinks = [
    project.supabaseDashboardUrl
      ? { label: 'Supabase dashboard', href: project.supabaseDashboardUrl, icon: Database }
      : null,
    project.publicUrl
      ? { label: 'Web publica', href: project.publicUrl, icon: Globe }
      : null,
    assignedRepoUrl
      ? { label: 'Repositorio GitHub', href: assignedRepoUrl, icon: GitBranch }
      : null,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a proyectos
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge type="project" value={project.status} />
            <StatusBadge type="priority" value={project.priority} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/clients/${client?.id}`} className="hover:text-foreground">
              {client?.name}
            </Link>{' '}
            · Liderado por {lead?.name}
          </p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground text-pretty">{project.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {assignedRepoName && (
            <a
              href={assignedRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              <GitBranch className="h-4 w-4" />
              {assignedRepoName.split('/')[1] || assignedRepoName}
            </a>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>Editar</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className="h-4 w-4" />
              {s.label}
            </div>
            <div className={`mt-2 text-lg font-semibold ${s.tone || 'text-card-foreground'}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Progreso general</span>
              <span className="text-muted-foreground">{project.progress}%</span>
            </div>
            <Progress value={project.progress} />
          </div>
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Horas consumidas</span>
              <span className="text-muted-foreground">{hoursPct}%</span>
            </div>
            <Progress value={hoursPct} tone={hoursPct > 100 ? 'destructive' : 'primary'} />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Equipo</div>
              <div className="text-sm font-medium">{members.length} personas</div>
            </div>
            <AvatarGroup members={members} max={4} />
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="tasks">Tareas ({projectTasks.length})</TabsTrigger>
          <TabsTrigger value="milestones">Hitos ({milestones.length})</TabsTrigger>
          <TabsTrigger value="team">Equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Hitos próximos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin hitos definidos.</p>
                ) : (
                  milestones.map((m) => (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{m.name}</span>
                          <StatusBadge type="task" value={m.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={m.progress} className="max-w-[160px]" />
                          <span className="text-xs text-muted-foreground">{formatDate(m.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Inicio" value={formatDate(project.startDate)} />
                <DetailRow label="Entrega" value={formatDate(project.dueDate)} />
                <DetailRow
                  label="Riesgo"
                  value={<StatusBadge type="priority" value={project.risk} className="capitalize" />}
                />
                <DetailRow label="Responsable" value={lead?.name} />
                <DetailRow label="Cliente" value={client?.name} />
                <DetailRow label="Repositorio" value={assignedRepoName || 'Sin repo'} />
                <DetailRow label="Presupuesto" value={formatCurrency(project.budget)} />
                {project.risk === 'high' && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Proyecto en riesgo alto. Requiere seguimiento cercano.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Links del proyecto</CardTitle>
              </CardHeader>
              <CardContent>
                {projectLinks.length === 0 ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Sin enlaces configurados para este proyecto.</p>
                    <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                      Anadir links
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {projectLinks.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:bg-muted"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-card-foreground">{item.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.href}</span>
                        </span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          {projectTasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Sin tareas" description="Este proyecto aún no tiene tareas." />
          ) : (
            <Card className="divide-y divide-border">
              {projectTasks.map((t) => {
                const assignee = getMember(t.assigneeId)
                return (
                  <div key={t.id} className="flex items-center gap-3 p-4">
                    <StatusBadge type="task" value={t.status} dot />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusBadge type="priority" value={t.priority} />
                        {t.repoIssue && <span>{t.repoIssue}</span>}
                        <span>· {t.logged}/{t.estimate}h</span>
                      </div>
                    </div>
                    {assignee ? (
                      <Avatar name={assignee.name} color={assignee.color} size="sm" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin asignar</span>
                    )}
                  </div>
                )
              })}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="milestones">
          {milestones.length === 0 ? (
            <EmptyState icon={ListChecks} title="Sin hitos" description="Define hitos para hacer seguimiento del progreso." />
          ) : (
            <div className="space-y-4">
              {milestones.map((m) => {
                const owner = getMember(m.ownerId)
                return (
                  <Card key={m.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{m.name}</span>
                          <StatusBadge type="task" value={m.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{formatDate(m.date)}</div>
                        {owner && <div className="mt-1">{owner.name}</div>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Progress value={m.progress} />
                      <span className="text-xs text-muted-foreground">{m.progress}%</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-4">
                <Avatar name={m.name} color={m.color} size="md" />
                <div className="min-w-0">
                  <Link href={`/team/${m.id}`} className="truncate text-sm font-medium hover:text-primary">
                    {m.name}
                    {m.id === lead?.id && <span className="ml-1 text-xs text-primary">· Lead</span>}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">{m.title}</div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <EditProjectModal project={project} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground">{value}</span>
    </div>
  )
}
