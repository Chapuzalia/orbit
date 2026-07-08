'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/page-header'
import { ProjectCard } from '@/components/project-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { Progress } from '@/components/ui/progress'
import { AvatarGroup } from '@/components/ui/avatar'
import { useAppData } from '@/lib/data-context'
import { CreateProjectModal } from '@/components/create-entity-modals'
import { PROJECT_STATUS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/format'
import { Search, LayoutGrid, List, Plus, FolderKanban, GitBranch } from 'lucide-react'

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  ...Object.entries(PROJECT_STATUS).map(([value, cfg]) => ({ value, label: cfg.label })),
]

export default function ProjectsPage() {
  const { projects, getClient, getMember } = useAppData()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [view, setView] = useState('grid')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const client = getClient(p.clientId)
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        client?.name.toLowerCase().includes(query.toLowerCase()) ||
        projectRepoName(p).toLowerCase().includes(query.toLowerCase())
      const matchesStatus = status === 'all' || p.status === status
      return matchesQuery && matchesStatus
    })
  }, [getClient, projects, query, status])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description={`${projects.length} proyectos · ${projects.filter((p) => ['development', 'review', 'planning'].includes(p.status)).length} activos`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proyecto o cliente..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setView('grid')}
            className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
            aria-label="Vista de cuadrícula"
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

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Sin proyectos"
          description="No hay proyectos que coincidan con los filtros seleccionados."
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Proyecto</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Repo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Progreso</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Equipo</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Presupuesto</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const client = getClient(p.clientId)
                  const members = p.memberIds.map(getMember).filter(Boolean)
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-accent/50"
                    >
                      <td className="px-4 py-3">
                        <a href={`/projects/${p.id}`} className="font-medium text-card-foreground hover:text-primary">
                          {p.name}
                        </a>
                        <div className="text-xs text-muted-foreground">{client?.name}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                        {p.githubRepoFullName ? (
                          <span className="inline-flex max-w-52 items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate font-mono text-xs">{p.githubRepoFullName}</span>
                          </span>
                        ) : (
                          <span className="text-xs">Sin repo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="project" value={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} className="w-20" />
                          <span className="text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <AvatarGroup members={members} max={3} size="sm" />
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {formatCurrency(p.budget)}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {formatDate(p.dueDate)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function projectRepoName(project) {
  return project.githubRepoFullName || ''
}
