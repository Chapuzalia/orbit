'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  deleteById,
  callRpc,
  getAuthUser,
  getStoredSession,
  insertRow,
  selectAll,
  updateById,
  updateWhere,
} from '@/lib/supabase-client'

const DataContext = createContext(null)

const EMPTY_ROWS = {
  organizations: [],
  members: [],
  clients: [],
  projects: [],
  milestones: [],
  tasks: [],
  repositories: [],
  pull_requests: [],
  commits: [],
  workflows: [],
  servers: [],
  server_metrics: [],
  invoices: [],
  payments: [],
  subscriptions: [],
  revenue_by_month: [],
  notifications: [],
  activity: [],
  meetings: [],
  todo_lists: [],
  todo_items: [],
  user_preferences: [],
  integrations: [],
  credentials: [],
}

const asArray = (value) => (Array.isArray(value) ? value : [])
const num = (value) => Number(value || 0)

function memberFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    authUserId: row.auth_user_id,
    name: row.name,
    email: row.email,
    title: row.title,
    role: row.role,
    phone: row.phone,
    availability: row.availability || 'available',
    capacity: num(row.capacity || 40),
    logged: num(row.logged),
    skills: asArray(row.skills),
    joined: row.joined,
    color: row.color,
    avatar: row.avatar_url,
    bio: row.bio,
    location: row.location,
  }
}

function clientFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    legalName: row.legal_name,
    taxId: row.tax_id,
    contact: row.contact,
    email: row.email,
    phone: row.phone,
    address: row.address,
    status: row.status || 'lead',
    type: row.type,
    revenue: num(row.revenue),
    pending: num(row.pending),
    activeProjects: Number(row.active_projects || 0),
    completedProjects: Number(row.completed_projects || 0),
    lastContact: row.last_contact,
    color: row.color,
  }
}

function projectFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    clientId: row.client_id,
    description: row.description,
    status: row.status || 'idea',
    priority: row.priority || 'medium',
    progress: Number(row.progress || 0),
    leadId: row.lead_id,
    memberIds: asArray(row.member_ids),
    startDate: row.start_date,
    dueDate: row.due_date,
    budget: num(row.budget),
    estimatedHours: num(row.estimated_hours),
    loggedHours: num(row.logged_hours),
    risk: row.risk || 'low',
    tech: asArray(row.tech),
    supabaseDashboardUrl: row.supabase_dashboard_url,
    publicUrl: row.public_url,
    githubRepoFullName: row.github_repo_full_name,
    repoIds: asArray(row.repo_ids),
    lastActivity: row.last_activity,
    serverIds: asArray(row.server_ids),
  }
}

function milestoneFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    date: row.date,
    status: row.status || 'todo',
    ownerId: row.owner_id,
    progress: Number(row.progress || 0),
  }
}

function taskFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    projectId: row.project_id,
    assigneeId: row.assignee_id,
    collaborators: asArray(row.collaborators),
    status: row.status || 'todo',
    priority: row.priority || 'medium',
    startDate: row.start_date,
    dueDate: row.due_date,
    estimate: num(row.estimate),
    logged: num(row.logged),
    tags: asArray(row.tags),
    checklist: asArray(row.checklist),
    comments: Number(row.comments || 0),
    subtasks: Number(row.subtasks || 0),
    repoIssue: row.repo_issue,
  }
}

function repositoryFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    projectId: row.project_id,
    description: row.description,
    visibility: row.visibility || 'private',
    language: row.language,
    stars: Number(row.stars || 0),
    openIssues: Number(row.open_issues || 0),
    openPRs: Number(row.open_prs || 0),
    lastCommit: row.last_commit,
    lastRelease: row.last_release,
    ci: row.ci || 'passing',
    branches: Number(row.branches || 0),
    contributors: asArray(row.contributors),
  }
}

function pullRequestFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    repoId: row.repo_id,
    number: Number(row.number || 0),
    title: row.title,
    authorId: row.author_id,
    status: row.status || 'open',
    reviewers: asArray(row.reviewers),
    additions: Number(row.additions || 0),
    deletions: Number(row.deletions || 0),
    createdAt: row.created_at,
    checks: row.checks || 'passing',
  }
}

function commitFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    repoId: row.repo_id,
    message: row.message,
    authorId: row.author_id,
    sha: row.sha,
    createdAt: row.created_at,
  }
}

function workflowFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    repoId: row.repo_id,
    name: row.name,
    status: row.status || 'passing',
    branch: row.branch,
    duration: row.duration,
    runAt: row.run_at,
  }
}

function serverFromRow(row) {
  const staleMs = row.last_check ? Date.now() - new Date(row.last_check).getTime() : Number.POSITIVE_INFINITY
  const status = staleMs > 3 * 60 * 1000 ? 'offline' : row.status || 'operational'
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    provider: row.provider,
    ip: row.ip,
    location: row.location,
    os: row.os,
    status,
    uptime: row.uptime,
    cpu: Number(row.cpu || 0),
    ram: Number(row.ram || 0),
    disk: Number(row.disk || 0),
    load: num(row.load),
    latency: Number(row.latency || 0),
    services: asArray(row.services),
    docker: Number(row.docker || 0),
    domains: asArray(row.domains),
    ssl: row.ssl || 'n/a',
    sslExpiry: row.ssl_expiry,
    lastCheck: row.last_check,
    incidents: Number(row.incidents || 0),
  }
}

function serverMetricFromRow(row) {
  const checkedAt = row.checked_at || row.created_at
  const d = checkedAt ? new Date(checkedAt) : null
  return {
    id: row.id,
    serverId: row.server_id,
    organizationId: row.organization_id,
    cpu: Number(row.cpu || 0),
    ram: Number(row.ram || 0),
    disk: Number(row.disk || 0),
    load: num(row.load),
    latency: Number(row.latency || 0),
    uptime: row.uptime,
    status: row.status || 'operational',
    checkedAt,
    t: d ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(d) : '',
  }
}

function invoiceFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    projectId: row.project_id,
    amount: num(row.amount),
    status: row.status || 'draft',
    issued: row.issued,
    due: row.due,
    concept: row.concept,
  }
}

function paymentFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceId: row.invoice_id,
    clientId: row.client_id,
    amount: num(row.amount),
    method: row.method,
    date: row.date,
    status: row.status || 'pending',
  }
}

function subscriptionFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    plan: row.plan,
    amount: num(row.amount),
    interval: row.interval || 'month',
    status: row.status || 'active',
    started: row.started,
    nextInvoice: row.next_invoice,
  }
}

function notificationFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    memberId: row.member_id,
    type: row.type,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    read: Boolean(row.read),
    href: row.href,
  }
}

function activityFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    actorId: row.actor_id,
    text: row.text,
    detail: row.detail,
    createdAt: row.created_at,
  }
}

function meetingFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    clientId: row.client_id,
    projectId: row.project_id,
    start: row.start,
    duration: Number(row.duration || 30),
    status: row.status || 'scheduled',
    location: row.location,
    link: row.link,
    attendees: asArray(row.attendees),
    externalAttendees: asArray(row.external_attendees),
    agenda: row.agenda,
  }
}

function credentialFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    name: row.name,
    category: row.category || 'other',
    site: row.site,
    username: row.username,
    email: row.email,
    password: row.password,
    recovery: row.recovery,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function todoItemFromRow(row) {
  return {
    id: row.id,
    listId: row.list_id,
    text: row.text,
    done: Boolean(row.done),
    priority: row.priority || 'medium',
    due: row.due,
    assigneeId: row.assignee_id,
    sortOrder: Number(row.sort_order || 0),
  }
}

function createAuthFallbackUser(session) {
  const user = session?.user
  if (!user?.email) return null
  const name = user.user_metadata?.name || user.email.split('@')[0]
  return {
    id: user.id,
    authUserId: user.id,
    name,
    email: user.email,
    role: 'Usuario',
    title: user.user_metadata?.title,
    phone: user.phone,
    color: 'oklch(0.54 0.21 268)',
    availability: 'available',
    capacity: 40,
    logged: 0,
    skills: [],
  }
}

function metricHistory(base, spread = 20, points = 24) {
  return Array.from({ length: points }, (_, i) => {
    const wave = Math.sin(i / 3) * spread
    const drift = Math.cos((i + base) / 4) * (spread / 3)
    const value = Math.max(2, Math.min(99, Math.round(base + wave + drift)))
    return { t: `${String(i).padStart(2, '0')}:00`, cpu: value, ram: Math.min(99, value + 8), disk: base - 5, net: Math.round(value * 1.4) }
  })
}

function buildData(rows, session) {
  const projects = rows.projects.map(projectFromRow)
  const tasks = rows.tasks.map(taskFromRow)
  const team = rows.members.map(memberFromRow).map((member) => ({
    ...member,
    tasks: tasks.filter((task) => task.assigneeId === member.id).length,
    projects: projects.filter((project) => project.leadId === member.id || project.memberIds.includes(member.id)).length,
  }))
  const clients = rows.clients.map(clientFromRow).map((client) => {
    const clientProjects = projects.filter((project) => project.clientId === client.id)
    return {
      ...client,
      activeProjects: client.activeProjects || clientProjects.filter((project) => !['production', 'maintenance', 'completed', 'cancelled'].includes(project.status)).length,
      completedProjects: client.completedProjects || clientProjects.filter((project) => ['production', 'maintenance', 'completed'].includes(project.status)).length,
    }
  })
  const organizationRow = rows.organizations[0]
  const organization = organizationRow
    ? {
        id: organizationRow.id,
        name: organizationRow.name,
        plan: organizationRow.plan,
        cif: organizationRow.cif,
        currency: organizationRow.currency,
        members: team.length,
      }
    : { id: null, name: 'Workspace', plan: 'Supabase', members: team.length }

  const authFallback = createAuthFallbackUser(session)
  const currentUser =
    team.find((member) => member.authUserId && member.authUserId === session?.user?.id) ||
    team.find((member) => member.email && member.email === session?.user?.email) ||
    authFallback

  const todoItems = rows.todo_items.map(todoItemFromRow)
  const todoLists = rows.todo_lists
    .map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      ownerId: row.owner_id,
      name: row.name,
      shared: Boolean(row.shared),
      sortOrder: Number(row.sort_order || 0),
      items: todoItems.filter((item) => item.listId === row.id).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const invoices = rows.invoices.map(invoiceFromRow)
  const meetings = rows.meetings.map(meetingFromRow)
  const servers = rows.servers.map(serverFromRow)
  const revenueByMonth = rows.revenue_by_month
    .map((row) => ({ id: row.id, month: row.month, ingresos: num(row.ingresos), recurrente: num(row.recurrente), sortOrder: Number(row.sort_order || 0) }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const dashboardMetrics = {
    activeProjects: projects.filter((p) => ['development', 'review', 'planning'].includes(p.status)).length,
    projectsAtRisk: projects.filter((p) => p.risk === 'high' || p.status === 'blocked').length,
    pendingTasks: tasks.filter((t) => ['todo', 'in_progress', 'review'].includes(t.status)).length,
    overdueTasks: tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length,
    meetingsThisWeek: meetings.filter((m) => new Date(m.start) > new Date()).length,
    monthlyRevenue: revenueByMonth.at(-1)?.ingresos || 0,
    pendingInvoices: invoices.filter((i) => ['pending', 'overdue', 'sent'].includes(i.status)).length,
    serversWithIssues: servers.filter((s) => ['warning', 'critical', 'offline'].includes(s.status)).length,
  }

  return {
    organization,
    currentUser,
    team,
    clients,
    projects,
    milestones: rows.milestones.map(milestoneFromRow),
    tasks,
    repositories: rows.repositories.map(repositoryFromRow),
    pullRequests: rows.pull_requests.map(pullRequestFromRow),
    commits: rows.commits.map(commitFromRow),
    workflows: rows.workflows.map(workflowFromRow),
    servers,
    serverMetrics: rows.server_metrics.map(serverMetricFromRow),
    invoices,
    payments: rows.payments.map(paymentFromRow),
    subscriptions: rows.subscriptions.map(subscriptionFromRow),
    revenueByMonth,
    notifications: rows.notifications.map(notificationFromRow),
    activity: rows.activity.map(activityFromRow),
    meetings,
    todoLists,
    preferences: rows.user_preferences[0] || null,
    integrations: rows.integrations.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      desc: row.description,
      connected: Boolean(row.connected),
    })),
    credentials: rows.credentials.map(credentialFromRow),
    dashboardMetrics,
  }
}

async function fetchRows() {
  const [
    organizations,
    members,
    clients,
    projects,
    milestones,
    tasks,
    repositories,
    pull_requests,
    commits,
    workflows,
    servers,
    server_metrics,
    invoices,
    payments,
    subscriptions,
    revenue_by_month,
    notifications,
    activity,
    meetings,
    todo_lists,
    todo_items,
    user_preferences,
    integrations,
    credentials,
  ] = await Promise.all([
    selectAll('organizations', { order: 'created_at.asc' }),
    selectAll('members', { order: 'name.asc' }),
    selectAll('clients', { order: 'name.asc' }),
    selectAll('projects', { order: 'created_at.desc' }),
    selectAll('milestones', { order: 'date.asc' }),
    selectAll('tasks', { order: 'due_date.asc' }),
    selectAll('repositories', { order: 'name.asc' }),
    selectAll('pull_requests', { order: 'created_at.desc' }),
    selectAll('commits', { order: 'created_at.desc' }),
    selectAll('workflows', { order: 'run_at.desc' }),
    selectAll('servers', { order: 'name.asc' }),
    selectAll('server_metrics', { order: 'checked_at.desc' }),
    selectAll('invoices', { order: 'issued.desc' }),
    selectAll('payments', { order: 'date.desc' }),
    selectAll('subscriptions', { order: 'created_at.desc' }),
    selectAll('revenue_by_month', { order: 'sort_order.asc' }),
    selectAll('notifications', { order: 'created_at.desc' }),
    selectAll('activity', { order: 'created_at.desc' }),
    selectAll('meetings', { order: 'start.asc' }),
    selectAll('todo_lists', { order: 'sort_order.asc' }),
    selectAll('todo_items', { order: 'sort_order.asc' }),
    selectAll('user_preferences', { order: 'created_at.asc' }),
    selectAll('integrations', { order: 'name.asc' }),
    selectAll('credentials', { order: 'updated_at.desc' }),
  ])

  return {
    organizations,
    members,
    clients,
    projects,
    milestones,
    tasks,
    repositories,
    pull_requests,
    commits,
    workflows,
    servers,
    server_metrics,
    invoices,
    payments,
    subscriptions,
    revenue_by_month,
    notifications,
    activity,
    meetings,
    todo_lists,
    todo_items,
    user_preferences,
    integrations,
    credentials,
  }
}

export function AppDataProvider({ children }) {
  const [rows, setRows] = useState(EMPTY_ROWS)
  const [session, setSession] = useState(() => getStoredSession())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let nextSession = getStoredSession()
      if (nextSession && !nextSession.user) {
        try {
          nextSession = { ...nextSession, user: await getAuthUser() }
        } catch {
          nextSession = getStoredSession()
        }
      }
      setSession(nextSession)
      setRows(await fetchRows())
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const data = useMemo(() => buildData(rows, session), [rows, session])

  const getMember = useCallback((id) => data.team.find((member) => member.id === id), [data.team])
  const getClient = useCallback((id) => data.clients.find((client) => client.id === id), [data.clients])
  const getProject = useCallback((id) => data.projects.find((project) => project.id === id), [data.projects])
  const getServer = useCallback((id) => data.servers.find((server) => server.id === id), [data.servers])
  const getServerMetrics = useCallback(
    (id, limit = 48) =>
      data.serverMetrics
        .filter((metric) => metric.serverId === id)
        .sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt))
        .slice(-limit),
    [data.serverMetrics],
  )
  const getTasks = useCallback((projectId) => data.tasks.filter((task) => task.projectId === projectId), [data.tasks])
  const getMilestones = useCallback((projectId) => data.milestones.filter((milestone) => milestone.projectId === projectId), [data.milestones])

  const updateTaskStatus = useCallback(async (id, status) => {
    await updateById('tasks', id, { status })
    setRows((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === id ? { ...task, status } : task)),
    }))
  }, [])

  const toggleTodoItem = useCallback(async (itemId, done) => {
    await updateById('todo_items', itemId, { done })
    setRows((prev) => ({
      ...prev,
      todo_items: prev.todo_items.map((item) => (item.id === itemId ? { ...item, done } : item)),
    }))
  }, [])

  const addTodoItem = useCallback(async (listId, text) => {
    const [created] = await insertRow('todo_items', {
      list_id: listId,
      text,
      done: false,
      priority: 'medium',
      assignee_id: data.currentUser?.id || null,
      sort_order: rows.todo_items.filter((item) => item.list_id === listId).length,
    })
    setRows((prev) => ({ ...prev, todo_items: [...prev.todo_items, created] }))
  }, [data.currentUser?.id, rows.todo_items])

  const removeTodoItem = useCallback(async (itemId) => {
    await deleteById('todo_items', itemId)
    setRows((prev) => ({
      ...prev,
      todo_items: prev.todo_items.filter((item) => item.id !== itemId),
    }))
  }, [])

  const markNotificationRead = useCallback(async (id) => {
    await updateById('notifications', id, { read: true })
    setRows((prev) => ({
      ...prev,
      notifications: prev.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
    }))
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    const ids = rows.notifications.filter((item) => !item.read).map((item) => item.id)
    if (ids.length === 0) return
    await updateWhere('notifications', `id=in.(${ids.join(',')})`, { read: true })
    setRows((prev) => ({
      ...prev,
      notifications: prev.notifications.map((item) => ({ ...item, read: true })),
    }))
  }, [rows.notifications])

  const updateCurrentMember = useCallback(async (values) => {
    if (!data.currentUser?.id || !rows.members.some((member) => member.id === data.currentUser.id)) {
      throw new Error('El usuario autenticado no tiene un miembro asociado en la tabla members.')
    }
    const payload = {
      ...(values.name !== undefined ? { name: values.name } : {}),
      ...(values.email !== undefined ? { email: values.email } : {}),
      ...(values.bio !== undefined ? { bio: values.bio } : {}),
      ...(values.phone !== undefined ? { phone: values.phone } : {}),
      ...(values.location !== undefined ? { location: values.location } : {}),
    }
    const [updated] = await updateById('members', data.currentUser.id, payload)
    setRows((prev) => ({
      ...prev,
      members: prev.members.map((member) => (member.id === data.currentUser.id ? updated : member)),
    }))
  }, [data.currentUser?.id, rows.members])

  const createClient = useCallback(async (values) => {
    const [created] = await insertRow('clients', {
      organization_id: data.organization?.id || null,
      name: values.name,
      legal_name: values.legalName || null,
      tax_id: values.taxId || null,
      contact: values.contact || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
      status: values.status || 'lead',
      type: values.type || null,
      color: values.color || null,
      last_contact: values.lastContact || null,
    })
    setRows((prev) => ({ ...prev, clients: [...prev.clients, created] }))
    return clientFromRow(created)
  }, [data.organization?.id])

  const createMember = useCallback(async (values) => {
    const [created] = await insertRow('members', {
      organization_id: data.organization?.id || null,
      name: values.name,
      email: values.email,
      title: values.title || null,
      role: values.role || null,
      phone: values.phone || null,
      availability: values.availability || 'available',
      capacity: Number(values.capacity || 40),
      logged: Number(values.logged || 0),
      skills: values.skills || [],
      joined: values.joined || null,
      color: values.color || null,
    })
    setRows((prev) => ({ ...prev, members: [...prev.members, created] }))
    return memberFromRow(created)
  }, [data.organization?.id])

  const createProject = useCallback(async (values) => {
    const [created] = await insertRow('projects', {
      organization_id: data.organization?.id || null,
      client_id: values.clientId || null,
      lead_id: values.leadId || null,
      name: values.name,
      description: values.description || null,
      status: values.status || 'idea',
      priority: values.priority || 'medium',
      progress: Number(values.progress || 0),
      member_ids: values.memberIds || [],
      start_date: values.startDate || null,
      due_date: values.dueDate || null,
      budget: Number(values.budget || 0),
      estimated_hours: Number(values.estimatedHours || 0),
      logged_hours: Number(values.loggedHours || 0),
      risk: values.risk || 'low',
      tech: values.tech || [],
      supabase_dashboard_url: values.supabaseDashboardUrl || null,
      public_url: values.publicUrl || null,
      github_repo_full_name: values.githubRepoFullName || null,
      last_activity: new Date().toISOString(),
    })
    setRows((prev) => ({ ...prev, projects: [created, ...prev.projects] }))
    return projectFromRow(created)
  }, [data.organization?.id])

  const updateProject = useCallback(async (id, values) => {
    const payload = {
      client_id: values.clientId || null,
      lead_id: values.leadId || null,
      name: values.name,
      description: values.description || null,
      status: values.status || 'idea',
      priority: values.priority || 'medium',
      progress: Number(values.progress || 0),
      member_ids: values.memberIds || [],
      start_date: values.startDate || null,
      due_date: values.dueDate || null,
      budget: Number(values.budget || 0),
      estimated_hours: Number(values.estimatedHours || 0),
      logged_hours: Number(values.loggedHours || 0),
      risk: values.risk || 'low',
      tech: values.tech || [],
      supabase_dashboard_url: values.supabaseDashboardUrl || null,
      public_url: values.publicUrl || null,
      github_repo_full_name: values.githubRepoFullName || null,
      last_activity: new Date().toISOString(),
    }
    const [updated] = await updateById('projects', id, payload)
    setRows((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => (project.id === id ? updated : project)),
    }))
    return projectFromRow(updated)
  }, [])

  const createTask = useCallback(async (values) => {
    const [created] = await insertRow('tasks', {
      organization_id: data.organization?.id || null,
      project_id: values.projectId || null,
      assignee_id: values.assigneeId || null,
      title: values.title,
      collaborators: values.collaborators || [],
      status: values.status || 'todo',
      priority: values.priority || 'medium',
      start_date: values.startDate || null,
      due_date: values.dueDate || null,
      estimate: Number(values.estimate || 0),
      logged: Number(values.logged || 0),
      tags: values.tags || [],
      checklist: [],
      comments: 0,
      subtasks: 0,
      repo_issue: values.repoIssue || null,
    })
    setRows((prev) => ({ ...prev, tasks: [...prev.tasks, created] }))
    return taskFromRow(created)
  }, [data.organization?.id])

  const createServer = useCallback(async (values) => {
    const result = await callRpc('create_monitored_server', {
      p_organization_id: data.organization?.id || null,
      p_name: values.name,
      p_agent_token: values.agentToken,
      p_provider: values.provider || null,
      p_ip: values.ip || null,
      p_location: values.location || null,
      p_os: values.os || null,
      p_domains: values.domains || [],
      p_services: values.services || [],
    })
    const created = Array.isArray(result) ? result[0] : result
    setRows((prev) => ({ ...prev, servers: [...prev.servers, created] }))
    return serverFromRow(created)
  }, [data.organization?.id])

  const createCredential = useCallback(async (values) => {
    const [created] = await insertRow('credentials', {
      organization_id: data.organization?.id || null,
      created_by: data.currentUser?.id || null,
      name: values.name,
      category: values.category || 'other',
      site: values.site || null,
      username: values.username || null,
      email: values.email || null,
      password: values.password || null,
      recovery: values.recovery || null,
      notes: values.notes || null,
    })
    setRows((prev) => ({ ...prev, credentials: [created, ...prev.credentials] }))
    return credentialFromRow(created)
  }, [data.currentUser?.id, data.organization?.id])

  const updateCredential = useCallback(async (id, values) => {
    const [updated] = await updateById('credentials', id, {
      name: values.name,
      category: values.category || 'other',
      site: values.site || null,
      username: values.username || null,
      email: values.email || null,
      password: values.password || null,
      recovery: values.recovery || null,
      notes: values.notes || null,
    })
    setRows((prev) => ({
      ...prev,
      credentials: prev.credentials.map((credential) => (credential.id === id ? updated : credential)),
    }))
    return credentialFromRow(updated)
  }, [])

  const deleteCredential = useCallback(async (id) => {
    await deleteById('credentials', id)
    setRows((prev) => ({
      ...prev,
      credentials: prev.credentials.filter((credential) => credential.id !== id),
    }))
  }, [])

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      refresh,
      getMember,
      getClient,
      getProject,
      getServer,
      getServerMetrics,
      getTasks,
      getMilestones,
      metricHistory,
      updateTaskStatus,
      toggleTodoItem,
      addTodoItem,
      removeTodoItem,
      markNotificationRead,
      markAllNotificationsRead,
      updateCurrentMember,
      createClient,
      createMember,
      createProject,
      updateProject,
      createTask,
      createServer,
      createCredential,
      updateCredential,
      deleteCredential,
    }),
    [
      data,
      loading,
      error,
      refresh,
      getMember,
      getClient,
      getProject,
      getServer,
      getServerMetrics,
      getTasks,
      getMilestones,
      updateTaskStatus,
      toggleTodoItem,
      addTodoItem,
      removeTodoItem,
      markNotificationRead,
      markAllNotificationsRead,
      updateCurrentMember,
      createClient,
      createMember,
      createProject,
      updateProject,
      createTask,
      createServer,
      createCredential,
      updateCredential,
      deleteCredential,
    ],
  )

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  if (error) {
    const sessionExpired = /sesion|session|refresh|jwt/i.test(error)
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">No se pudo conectar con Supabase</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Reintentar
            </button>
            {sessionExpired && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/login'
                }}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium"
              >
                Ir al login
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useAppData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useAppData debe usarse dentro de AppDataProvider.')
  return context
}
