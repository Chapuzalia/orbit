'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { formatDate } from '@/lib/format'
import { ArrowLeft, Mail, Phone, Calendar, Clock } from 'lucide-react'

export default function TeamMemberPage({ params }) {
  const { id } = use(params)
  const { getMember, projects, tasks, getProject } = useAppData()
  const member = getMember(id)
  if (!member) return notFound()

  const memberProjects = projects.filter((p) => p.memberIds.includes(id) || p.leadId === id)
  const memberTasks = tasks.filter((t) => t.assigneeId === id)
  const openTasks = memberTasks.filter((t) => t.status !== 'done')
  const util = Math.round((member.logged / member.capacity) * 100)

  return (
    <div className="space-y-6">
      <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Volver al equipo
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 text-center lg:col-span-1">
          <div className="flex flex-col items-center">
            <Avatar name={member.name} color={member.color} size="xl" />
            <h1 className="mt-4 text-xl font-semibold">{member.name}</h1>
            <p className="text-sm text-muted-foreground">{member.title}</p>
            <div className="mt-2">
              <StatusBadge type="availability" value={member.availability} />
            </div>
          </div>

          <div className="mt-6 space-y-2.5 text-left text-sm">
            <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <Mail className="h-4 w-4" />
              {member.email}
            </a>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              {member.phone}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              En el equipo desde {formatDate(member.joined)}
            </div>
          </div>

          <div className="mt-6 text-left">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Carga semanal</span>
              <span className="font-medium">{member.logged}/{member.capacity}h</span>
            </div>
            <Progress value={util} tone={util > 100 ? 'destructive' : util > 85 ? 'warning' : 'primary'} />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-1">
            {member.skills.map((s) => (
              <span key={s} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {s}
              </span>
            ))}
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            <StatBox label="Proyectos" value={memberProjects.length} />
            <StatBox label="Tareas abiertas" value={openTasks.length} />
            <StatBox label="Rol" value={member.role} small />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Proyectos ({memberProjects.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {memberProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary/40"
                >
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.leadId === member.id ? 'Lead' : 'Colaborador'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={p.progress} className="w-20" />
                    <StatusBadge type="project" value={p.status} />
                  </div>
                </Link>
              ))}
              {memberProjects.length === 0 && <p className="text-sm text-muted-foreground">Sin proyectos asignados.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tareas asignadas ({memberTasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {memberTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <StatusBadge type="task" value={t.status} dot />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{getProject(t.projectId)?.name}</div>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(t.dueDate, { year: undefined })}
                  </span>
                </div>
              ))}
              {memberTasks.length === 0 && <p className="text-sm text-muted-foreground">Sin tareas asignadas.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, small }) {
  return (
    <Card className="p-4 text-center">
      <div className={`font-semibold text-card-foreground ${small ? 'text-sm' : 'text-2xl'}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </Card>
  )
}
