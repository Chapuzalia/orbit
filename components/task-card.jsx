'use client'

import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { formatDate, daysUntil } from '@/lib/format'
import { MessageSquare, GitBranch, CheckSquare, Calendar } from 'lucide-react'

export function TaskCard({ task, onClick, draggable, onDragStart }) {
  const { getMember, getProject } = useAppData()
  const assignee = getMember(task.assigneeId)
  const project = getProject(task.projectId)
  const days = daysUntil(task.dueDate)
  const overdue = days < 0 && task.status !== 'done'
  const checklistDone = task.checklist?.filter((c) => c.done).length || 0

  return (
    <Card
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick?.()
      }}
      className="cursor-pointer space-y-2.5 p-3 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-card-foreground">{task.title}</span>
        <StatusBadge type="priority" value={task.priority} />
      </div>

      {project && (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          {project.name}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {task.tags?.map((tag) => (
          <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          {task.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {task.comments}
            </span>
          )}
          {task.checklist?.length > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5" />
              {checklistDone}/{task.checklist.length}
            </span>
          )}
          {task.repoIssue && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {task.repoIssue}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-destructive' : ''}`}>
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(task.dueDate, { year: undefined })}
          </span>
          {assignee && <Avatar name={assignee.name} color={assignee.color} size="sm" />}
        </div>
      </div>
    </Card>
  )
}
