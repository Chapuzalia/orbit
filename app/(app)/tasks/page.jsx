'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageHeader } from '@/components/page-header'
import { TaskCard } from '@/components/task-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { CreateTaskModal } from '@/components/create-entity-modals'
import { TASK_STATUS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { useToast } from '@/components/ui/toaster'
import { Search, Plus, LayoutGrid, List } from 'lucide-react'

const COLUMNS = [
  { id: 'todo', label: 'Por hacer' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'review', label: 'En revisión' },
  { id: 'blocked', label: 'Bloqueado' },
  { id: 'done', label: 'Completado' },
]

export default function TasksPage() {
  const { toast } = useToast()
  const { tasks, getMember, getProject, updateTaskStatus } = useAppData()
  const [taskList, setTaskList] = useState(tasks)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [view, setView] = useState('board')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(
    () => taskList.filter((t) => !query || t.title.toLowerCase().includes(query.toLowerCase())),
    [taskList, query],
  )

  useEffect(() => {
    setTaskList(tasks)
  }, [tasks])

  async function moveTask(id, status) {
    const t = taskList.find((x) => x.id === id)
    if (!t || t.status === status) return
    setTaskList((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    try {
      await updateTaskStatus(id, status)
      toast({ title: 'Tarea actualizada', description: `"${t.title}" movida a ${TASK_STATUS[status].label}.` })
    } catch (err) {
      setTaskList((prev) => prev.map((task) => (task.id === id ? { ...task, status: t.status } : task)))
      toast({ title: 'No se pudo actualizar', description: err.message || 'Revisa la conexion con Supabase.', tone: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tareas"
        description={`${taskList.length} tareas · ${taskList.filter((t) => t.status !== 'done').length} pendientes`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarea..." className="pl-9" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setView('board')}
            className={`rounded-md p-1.5 ${view === 'board' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
            aria-label="Vista de tablero"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`rounded-md p-1.5 ${view === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
            aria-label="Vista de lista"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id)
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) moveTask(dragId, col.id)
                  setDragId(null)
                }}
                className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge type="task" value={col.id} dot />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2.5">
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onClick={() => setSelected(t)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                      Sin tareas
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tarea</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Prioridad</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Proyecto</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Entrega</th>
                <th className="px-4 py-3 font-medium">Resp.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const assignee = getMember(t.assigneeId)
                const project = getProject(t.projectId)
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-4 py-3 font-medium">{t.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge type="task" value={t.status} />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <StatusBadge type="priority" value={t.priority} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{project?.name}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(t.dueDate)}</td>
                    <td className="px-4 py-3">
                      {assignee ? <Avatar name={assignee.name} color={assignee.color} size="sm" /> : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TaskModal task={selected} onClose={() => setSelected(null)} onMove={moveTask} />
      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function TaskModal({ task, onClose, onMove }) {
  const { getMember, getProject } = useAppData()
  if (!task) return null
  const assignee = getMember(task.assigneeId)
  const project = getProject(task.projectId)
  const collaborators = (task.collaborators || []).map(getMember).filter(Boolean)
  const checklistDone = task.checklist?.filter((c) => c.done).length || 0
  const checklistPct = task.checklist?.length ? Math.round((checklistDone / task.checklist.length) * 100) : 0

  return (
    <Modal open={!!task} onClose={onClose} title={task.title} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge type="task" value={task.status} />
          <StatusBadge type="priority" value={task.priority} />
          {task.repoIssue && (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{task.repoIssue}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Proyecto" value={project?.name} />
          <Field label="Entrega" value={formatDate(task.dueDate)} />
          <Field label="Estimado" value={`${task.estimate}h`} />
          <Field label="Registrado" value={`${task.logged}h`} />
        </div>

        {task.checklist?.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Checklist</span>
              <span className="text-muted-foreground">{checklistDone}/{task.checklist.length}</span>
            </div>
            <Progress value={checklistPct} className="mb-3" />
            <div className="space-y-2">
              {task.checklist.map((c, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked={c.done} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className={c.done ? 'text-muted-foreground line-through' : ''}>{c.t}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">Responsable</div>
            {assignee ? (
              <div className="flex items-center gap-2">
                <Avatar name={assignee.name} color={assignee.color} size="sm" />
                <span className="text-sm font-medium">{assignee.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Sin asignar</span>
            )}
          </div>
          {collaborators.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">Colaboradores</div>
              <div className="flex -space-x-2">
                {collaborators.map((c) => (
                  <Avatar key={c.id} name={c.name} color={c.color} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
            <Button
              key={c.id}
              variant="outline"
              size="sm"
              onClick={() => {
                onMove(task.id, c.id)
                onClose()
              }}
            >
              Mover a {c.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium text-card-foreground">{value || '—'}</div>
    </div>
  )
}
