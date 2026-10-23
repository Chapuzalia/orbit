'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { requireWorkspace } from '@/lib/workspace.mjs'
import { billingValues } from '@/lib/client-billing.mjs'
import {
  deleteById,
  createMonitoredServer,
  getAuthUser,
  getPocketBase,
  getStoredSession,
  insertRow,
  selectAll,
  updateById,
} from '@/lib/pocketbase-client'

const DataContext = createContext(null)

const EMPTY_ROWS = {
  organizations: [],
  clients: [],
  sales_reps: [],
  servers: [],
  invoices: [],
  payments: [],
  subscriptions: [],
  revenue_by_month: [],
  notifications: [],
  activity: [],
  user_preferences: [],
  integrations: [],
  credentials: [],
}

const asArray = (value) => (Array.isArray(value) ? value : [])
const num = (value) => Number(value || 0)

function clientFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    salesRepId: row.sales_rep_id || '',
    billingCycle: row.billing_cycle || 'none',
    billingAmount: num(row.billing_amount),
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
    lastContact: row.last_contact,
    color: row.color,
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

function salesRepFromRow(row) {
  return { id: row.id, organizationId: row.organization_id, name: row.name, email: row.email, phone: row.phone, notes: row.notes }
}

function invoiceFromRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    number: row.number || row.id,
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

function buildData(rows, session) {
  const organizationRow = rows.organizations.find((row) => row.id === session?.user?.organization_id)
  const organization = organizationRow || { id: null, name: 'Orbit', plan: 'PocketBase', currency: 'EUR' }
  const user = session?.user
  const currentUser = user ? { ...user, name: user.name || user.email?.split('@')[0] || 'Usuario', avatar: user.avatar_url } : null
  const clients = rows.clients.map(clientFromRow)
  const invoices = rows.invoices.map(invoiceFromRow)
  const servers = rows.servers.map(serverFromRow)
  const revenueByMonth = rows.revenue_by_month
    .map((row) => ({ id: row.id, month: row.month, ingresos: num(row.ingresos), recurrente: num(row.recurrente), sortOrder: num(row.sort_order) }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    organization, currentUser, clients, invoices, servers, revenueByMonth,
    salesReps: rows.sales_reps.map(salesRepFromRow),
    payments: rows.payments.map(paymentFromRow),
    subscriptions: rows.subscriptions.map(subscriptionFromRow),
    notifications: rows.notifications.map(notificationFromRow),
    activity: rows.activity.map(activityFromRow),
    preferences: rows.user_preferences[0] || null,
    integrations: rows.integrations.map((row) => ({ ...row, desc: row.description })),
    credentials: rows.credentials.map(credentialFromRow),
    dashboardMetrics: {
      activeClients: clients.filter((client) => client.status === 'active').length,
      monthlyRevenue: revenueByMonth.at(-1)?.ingresos || 0,
      pendingInvoices: invoices.filter((invoice) => ['pending', 'overdue', 'sent'].includes(invoice.status)).length,
      serversWithIssues: servers.filter((server) => ['warning', 'critical', 'offline'].includes(server.status)).length,
    },
  }
}

async function fetchRows() {
  const orders = {
    organizations: 'created_at.asc', clients: 'name.asc', sales_reps: 'name.asc', servers: 'name.asc',
    invoices: 'issued.desc', payments: 'date.desc', subscriptions: 'created_at.desc', revenue_by_month: 'sort_order.asc',
    notifications: 'created_at.desc', activity: 'created_at.desc', user_preferences: 'created_at.asc',
    integrations: 'name.asc', credentials: 'updated_at.desc',
  }
  const entries = await Promise.all(Object.entries(orders).map(async ([table, order]) => [table, await selectAll(table, { order })]))
  return Object.fromEntries(entries)
}

export function AppDataProvider({ children }) {
  const [rows, setRows] = useState(EMPTY_ROWS)
  const [session, setSession] = useState(() => getStoredSession())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    setErrorCode('')
    try {
      let nextSession = getStoredSession()
      if (nextSession) {
        nextSession = { ...nextSession, user: await getAuthUser() }
      }
      if (!nextSession) throw new Error('Sesion expirada. Inicia sesion de nuevo.')
      requireWorkspace(nextSession.user)
      const nextRows = await fetchRows()
      requireWorkspace(nextSession.user, nextRows.organizations)
      setSession(nextSession)
      setRows(nextRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos.')
      setErrorCode(err.code || '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (loading || error) return
    let active = true
    const timer = window.setInterval(async () => {
      try {
        const servers = await selectAll('servers', { order: 'name.asc' })
        if (active) setRows((prev) => ({ ...prev, servers }))
      } catch { /* Keep the last known metrics during a temporary outage. */ }
    }, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [loading, error])

  const data = useMemo(() => buildData(rows, session), [rows, session])

  const getClient = useCallback((id) => data.clients.find((client) => client.id === id), [data.clients])
  const getServer = useCallback((id) => data.servers.find((server) => server.id === id), [data.servers])
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
    await Promise.all(ids.map((id) => updateById('notifications', id, { read: true })))
    setRows((prev) => ({
      ...prev,
      notifications: prev.notifications.map((item) => ({ ...item, read: true })),
    }))
  }, [rows.notifications])

  const updateCurrentUser = useCallback(async (values) => {
    if (!data.currentUser?.id) throw new Error('Inicia sesion para editar tu perfil.')
    const { name, bio, phone, location } = values
    const [updated] = await updateById('users', data.currentUser.id, { name, bio, phone, location })
    const pb = getPocketBase()
    pb.authStore.save(pb.authStore.token, updated)
    setSession(getStoredSession())
  }, [data.currentUser?.id])

  const createClient = useCallback(async (values) => {
    const [created] = await insertRow('clients', {
      ...billingValues(values),
      organization_id: data.organization?.id || null,
      name: values.name,
      legal_name: values.legalName || null,
      sales_rep_id: values.salesRepId || '',
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

  const updateClientBilling = useCallback(async (id, values) => {
    const [updated] = await updateById('clients', id, billingValues(values))
    setRows((prev) => ({ ...prev, clients: prev.clients.map((row) => row.id === id ? updated : row) }))
  }, [])

  const createSalesRep = useCallback(async (values) => {
    const [created] = await insertRow('sales_reps', { organization_id: data.organization.id, ...values })
    setRows((prev) => ({ ...prev, sales_reps: [...prev.sales_reps, created] }))
    return salesRepFromRow(created)
  }, [data.organization.id])

  const updateSalesRep = useCallback(async (id, values) => {
    const [updated] = await updateById('sales_reps', id, values)
    setRows((prev) => ({ ...prev, sales_reps: prev.sales_reps.map((row) => row.id === id ? updated : row) }))
  }, [])

  const deleteSalesRep = useCallback(async (id) => {
    await deleteById('sales_reps', id)
    setRows((prev) => ({
      ...prev,
      sales_reps: prev.sales_reps.filter((row) => row.id !== id),
      clients: prev.clients.map((row) => row.sales_rep_id === id ? { ...row, sales_rep_id: '' } : row),
    }))
  }, [])

  const assignClientSalesRep = useCallback(async (clientId, salesRepId) => {
    const [updated] = await updateById('clients', clientId, { sales_rep_id: salesRepId || '' })
    setRows((prev) => ({ ...prev, clients: prev.clients.map((row) => row.id === clientId ? updated : row) }))
  }, [])

  const createServer = useCallback(async (values) => {
    const created = await createMonitoredServer({
      organization_id: data.organization?.id || '', name: values.name, agent_token: values.agentToken,
      provider: values.provider || '', ip: values.ip || '', location: values.location || '', os: values.os || '',
      domains: values.domains || [], services: values.services || [],
    })
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

  const updateOrganization = useCallback(async (values) => {
    const [updated] = await updateById('organizations', data.organization.id, values)
    setRows((prev) => ({ ...prev, organizations: prev.organizations.map((row) => row.id === updated.id ? updated : row) }))
  }, [data.organization.id])

  const savePreferences = useCallback(async (notifications) => {
    const values = { organization_id: data.organization.id, user_id: data.currentUser.id, notifications }
    const [updated] = data.preferences
      ? await updateById('user_preferences', data.preferences.id, { notifications })
      : await insertRow('user_preferences', values)
    setRows((prev) => ({ ...prev, user_preferences: [updated] }))
  }, [data.organization.id, data.currentUser?.id, data.preferences])

  const setIntegrationConnected = useCallback(async (id, connected) => {
    const [updated] = await updateById('integrations', id, { connected })
    setRows((prev) => ({ ...prev, integrations: prev.integrations.map((row) => row.id === id ? updated : row) }))
  }, [])

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      refresh,
      getClient,
      getServer,
      markNotificationRead,
      markAllNotificationsRead,
      updateCurrentUser,
      createClient,
      updateClientBilling,
      createSalesRep,
      updateSalesRep,
      deleteSalesRep,
      assignClientSalesRep,
      createServer,
      createCredential,
      updateCredential,
      deleteCredential,
      updateOrganization,
      savePreferences,
      setIntegrationConnected,
    }),
    [
      data,
      loading,
      error,
      refresh,
      getClient,
      getServer,
      markNotificationRead,
      markAllNotificationsRead,
      updateCurrentUser,
      createClient,
      updateClientBilling,
      createSalesRep,
      updateSalesRep,
      deleteSalesRep,
      assignClientSalesRep,
      createServer,
      createCredential,
      updateCredential,
      deleteCredential,
      updateOrganization,
      savePreferences,
      setIntegrationConnected,
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
          <h1 className="text-lg font-semibold">{errorCode === 'ORBIT_WORKSPACE' ? 'Revisa el workspace de tu cuenta' : 'No se pudo conectar con PocketBase'}</h1>
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
