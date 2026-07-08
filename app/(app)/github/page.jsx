'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { useAppData } from '@/lib/data-context'
import { relativeTime } from '@/lib/format'
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Globe,
  Lock,
  Play,
  RefreshCw,
  Star,
  XCircle,
} from 'lucide-react'

const LANG_COLOR = {
  TypeScript: 'oklch(0.6 0.16 240)',
  JavaScript: 'oklch(0.78 0.15 75)',
  Go: 'oklch(0.62 0.16 200)',
  PHP: 'oklch(0.65 0.18 285)',
  Python: 'oklch(0.7 0.14 85)',
  CSS: 'oklch(0.58 0.2 255)',
}

function CI({ status }) {
  if (status === 'passing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        CI OK
      </span>
    )
  }

  if (status === 'failing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        CI falla
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
        <Play className="h-3.5 w-3.5" />
        CI en curso
      </span>
    )
  }

  return <span className="text-xs font-medium text-muted-foreground">Sin CI</span>
}

function shortRepoName(repo) {
  return repo?.name?.split('/').pop() || repo?.repoName?.split('/').pop() || repo?.name || 'repo'
}

function authorName(item, fallback) {
  return item.authorName || fallback?.name || 'GitHub'
}

function repoUrl(repo) {
  return repo?.url || (repo?.name ? `https://github.com/${repo.name}` : '')
}

function workflowBadge(status) {
  if (status === 'passing') return { tone: 'success', label: 'passing' }
  if (status === 'failing') return { tone: 'destructive', label: 'failing' }
  if (status === 'pending') return { tone: 'warning', label: 'running' }
  return { tone: 'muted', label: 'unknown' }
}

export default function GithubPage() {
  const { repositories, pullRequests, commits, workflows, getMember, getProject, projects } = useAppData()
  const [tab, setTab] = useState('repos')
  const [githubData, setGithubData] = useState(null)
  const [loadingGithub, setLoadingGithub] = useState(false)
  const [githubError, setGithubError] = useState('')

  const loadGithub = useCallback(async () => {
    setLoadingGithub(true)
    setGithubError('')
    try {
      const response = await fetch('/api/github', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar GitHub.')
      setGithubData(payload)
    } catch (err) {
      setGithubData(null)
      setGithubError(err.message)
    } finally {
      setLoadingGithub(false)
    }
  }, [])

  useEffect(() => {
    loadGithub()
  }, [loadGithub])

  const usingGithub = githubData?.source === 'github'
  const visibleRepositories = usingGithub ? githubData.repositories : repositories
  const visiblePullRequests = usingGithub ? githubData.pullRequests : pullRequests
  const visibleCommits = usingGithub ? githubData.commits : commits
  const visibleWorkflows = usingGithub ? githubData.workflows : workflows

  const projectByRepo = useMemo(() => {
    const map = new Map()
    for (const project of projects) {
      if (project.githubRepoFullName) {
        map.set(project.githubRepoFullName.toLowerCase(), project)
      }
      const key = project.name?.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (key) map.set(key, project)
    }
    return map
  }, [projects])

  function resolveProject(repo) {
    const storedProject = getProject(repo.projectId)
    if (storedProject) return storedProject
    const assigned = repo.name ? projectByRepo.get(repo.name.toLowerCase()) : null
    if (assigned) return assigned
    const repoName = shortRepoName(repo).toLowerCase().replace(/[^a-z0-9]/g, '')
    return projectByRepo.get(repoName)
  }

  const totalPRs = visibleRepositories.reduce((sum, repo) => sum + Number(repo.openPRs || 0), 0)
  const totalIssues = visibleRepositories.reduce((sum, repo) => sum + Number(repo.openIssues || 0), 0)
  const failing = visibleRepositories.filter((repo) => repo.ci === 'failing').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="GitHub"
        description={
          usingGithub
            ? `${githubData.owner} conectado · ${visibleRepositories.length} repositorios · ${totalPRs} PRs abiertas`
            : `${visibleRepositories.length} repositorios · ${totalPRs} PRs abiertas · ${totalIssues} issues`
        }
        actions={
          <Button type="button" variant="outline" onClick={loadGithub} disabled={loadingGithub}>
            <RefreshCw className={loadingGithub ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refrescar
          </Button>
        }
      />

      {githubError && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">GitHub no esta conectado en vivo.</p>
            <p className="text-muted-foreground">{githubError}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={GitBranch} label="Repositorios" value={visibleRepositories.length} />
        <Stat icon={GitPullRequest} label="PRs abiertas" value={totalPRs} tone="chart-2" />
        <Stat icon={CircleDot} label="Issues abiertas" value={totalIssues} tone="chart-4" />
        <Stat icon={Play} label="Pipelines en fallo" value={failing} danger={failing > 0} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="repos">Repositorios</TabsTrigger>
          <TabsTrigger value="prs">Pull Requests</TabsTrigger>
          <TabsTrigger value="commits">Commits</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="repos">
          {visibleRepositories.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="Sin repositorios"
              description="Configura GITHUB_ORG en .env.local para leer los repositorios publicos de tu organizacion."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleRepositories.map((repo) => {
                const project = resolveProject(repo)
                const url = repoUrl(repo)
                return (
                  <Card key={repo.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="space-y-3 pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {repo.visibility === 'private' ? (
                              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-mono text-sm font-semibold hover:text-primary"
                              >
                                {repo.name}
                              </a>
                            ) : (
                              <span className="truncate font-mono text-sm font-semibold">{repo.name}</span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{repo.description || 'Sin descripcion'}</p>
                        </div>
                        <CI status={repo.ci} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG_COLOR[repo.language] || 'oklch(0.6 0.02 265)' }} />
                          {repo.language || 'Sin lenguaje'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          {repo.stars}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitPullRequest className="h-3.5 w-3.5" />
                          {repo.openPRs}
                        </span>
                        <span className="flex items-center gap-1">
                          <CircleDot className="h-3.5 w-3.5" />
                          {repo.openIssues}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          {repo.branches}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                        {project ? (
                          <Link href={`/projects/${project.id}`} className="text-primary hover:underline">
                            {project.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Sin proyecto asociado</span>
                        )}
                        <span className="text-muted-foreground">
                          {repo.defaultBranch ? `${repo.defaultBranch} · ` : ''}
                          {relativeTime(repo.lastCommit)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prs">
          <ListCard
            empty={<EmptyState icon={GitPullRequest} title="Sin pull requests" description="No hay PRs abiertas en los repositorios cargados." />}
          >
            {visiblePullRequests.map((pr) => {
              const repo = visibleRepositories.find((item) => item.id === pr.repoId)
              const author = getMember(pr.authorId)
              return (
                <div key={pr.id} className="flex items-center gap-3 px-4 py-3">
                  <GitPullRequest className="h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <a href={pr.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary">
                      {pr.title}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{shortRepoName(repo || pr)}</span> #{pr.number} · {authorName(pr, author)}
                    </p>
                  </div>
                  <StatusBadge type="pr" value={pr.status} dot />
                  <span className="hidden text-xs text-muted-foreground sm:block">{relativeTime(pr.createdAt)}</span>
                </div>
              )
            })}
          </ListCard>
        </TabsContent>

        <TabsContent value="commits">
          <ListCard
            empty={<EmptyState icon={GitCommit} title="Sin commits" description="No se han recibido commits recientes desde GitHub." />}
          >
            {visibleCommits.map((commit) => {
              const repo = visibleRepositories.find((item) => item.id === commit.repoId)
              const author = getMember(commit.authorId)
              return (
                <div key={commit.id} className="flex items-center gap-3 px-4 py-3">
                  <GitCommit className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Avatar name={authorName(commit, author)} color={author?.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    {commit.url ? (
                      <a href={commit.url} target="_blank" rel="noreferrer" className="block truncate text-sm hover:text-primary">
                        {commit.message}
                      </a>
                    ) : (
                      <p className="truncate text-sm">{commit.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{shortRepoName(repo || commit)}</span> · {authorName(commit, author)}
                    </p>
                  </div>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{commit.sha}</code>
                  <span className="hidden text-xs text-muted-foreground sm:block">{relativeTime(commit.createdAt)}</span>
                </div>
              )
            })}
          </ListCard>
        </TabsContent>

        <TabsContent value="actions">
          <ListCard
            empty={<EmptyState icon={Play} title="Sin ejecuciones" description="No hay ejecuciones recientes de GitHub Actions para estos repositorios." />}
          >
            {visibleWorkflows.map((workflow) => {
              const repo = visibleRepositories.find((item) => item.id === workflow.repoId)
              const badge = workflowBadge(workflow.status)
              const ok = workflow.status === 'passing'
              return (
                <div key={workflow.id} className="flex items-center gap-3 px-4 py-3">
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : workflow.status === 'failing' ? (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <Play className="h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0 flex-1">
                    {workflow.url ? (
                      <a href={workflow.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary">
                        {workflow.name}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-medium">{workflow.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{shortRepoName(repo || workflow)}</span> ·{' '}
                      <span className="font-mono">{workflow.branch || 'branch'}</span>
                      {workflow.duration ? ` · ${workflow.duration}` : ''}
                    </p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  <span className="hidden text-xs text-muted-foreground sm:block">{relativeTime(workflow.runAt)}</span>
                </div>
              )
            })}
          </ListCard>
        </TabsContent>
      </Tabs>

      {usingGithub && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
          Datos leidos desde GitHub. Ultima sincronizacion: {relativeTime(githubData.fetchedAt)}
          {githubData.rateRemaining != null ? ` · cuota restante: ${githubData.rateRemaining}` : ''}
        </div>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone = 'primary', danger = false }) {
  const color = danger
    ? 'bg-destructive/10 text-destructive'
    : tone === 'chart-2'
      ? 'bg-chart-2/15 text-chart-2'
      : tone === 'chart-4'
        ? 'bg-chart-4/20 text-chart-4'
        : 'bg-primary/10 text-primary'
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ListCard({ children, empty }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  if (!items || items.length === 0) return empty

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">{items}</CardContent>
    </Card>
  )
}
