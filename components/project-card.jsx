'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import { AvatarGroup } from '@/components/ui/avatar'
import { useAppData } from '@/lib/data-context'
import { formatCurrency, formatDate, daysUntil } from '@/lib/format'
import { AlertTriangle, Clock, GitBranch } from 'lucide-react'

export function ProjectCard({ project }) {
  const { getClient, getMember } = useAppData()
  const client = getClient(project.clientId)
  const lead = getMember(project.leadId)
  const members = project.memberIds.map(getMember).filter(Boolean)
  const days = daysUntil(project.dueDate)
  const overdue = days < 0 && project.progress < 100

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="flex h-full flex-col p-5 transition-all hover:border-primary/40 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary">
              {project.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{client?.name}</p>
          </div>
          <StatusBadge type="project" value={project.status} />
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>

        {project.githubRepoFullName && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate font-mono">{project.githubRepoFullName}</span>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium text-card-foreground">{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(project.budget)}</span>
          <span className="flex items-center gap-1">
            {overdue ? (
              <span className="flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Vencido
              </span>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" />
                {formatDate(project.dueDate)}
              </>
            )}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <AvatarGroup members={[lead, ...members.filter((m) => m.id !== lead?.id)].filter(Boolean)} max={4} size="sm" />
          <StatusBadge type="priority" value={project.priority} />
        </div>
      </Card>
    </Link>
  )
}
