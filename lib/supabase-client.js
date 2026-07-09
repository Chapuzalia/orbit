'use client'

const SESSION_KEY = 'orbit_supabase_session'
const COOKIE_KEY = 'orbit_session'
const REFRESH_MARGIN_SECONDS = 60

let refreshPromise = null

function clean(value) {
  return (value || '').trim()
}

export function getSupabaseUrl() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, '')
}

export function getSupabaseAnonKey() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}

export function getStoredSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeSession(session) {
  if (typeof window === 'undefined') return
  const normalized = normalizeSession(session)
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(normalized))
  document.cookie = `${COOKIE_KEY}=1; path=/; max-age=604800`
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`
}

function normalizeSession(session) {
  if (!session) return session
  const expiresAt =
    session.expires_at ||
    (session.expires_in ? Math.floor(Date.now() / 1000) + Number(session.expires_in) : undefined)
  return expiresAt ? { ...session, expires_at: expiresAt } : session
}

function isJwtExpiredMessage(message = '') {
  const value = String(message).toLowerCase()
  return value.includes('jwt expired') || value.includes('invalid jwt') || value.includes('invalid claim')
}

async function refreshStoredSession() {
  const current = getStoredSession()
  if (!current?.refresh_token) {
    clearStoredSession()
    throw new Error('Sesion expirada. Inicia sesion de nuevo.')
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: getSupabaseAnonKey(),
          Authorization: `Bearer ${getSupabaseAnonKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      })
      const payload = await parseResponse(response)
      if (!response.ok) {
        clearStoredSession()
        const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Sesion expirada.'
        throw new Error(message)
      }
      const next = normalizeSession({
        ...current,
        ...payload,
        user: payload?.user || current.user,
      })
      storeSession(next)
      return next
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function getValidSession({ forceRefresh = false } = {}) {
  const session = normalizeSession(getStoredSession())
  if (!session?.access_token) return null

  const now = Math.floor(Date.now() / 1000)
  const shouldRefresh = forceRefresh || (session.expires_at && session.expires_at - now <= REFRESH_MARGIN_SECONDS)
  if (!shouldRefresh) return session

  return refreshStoredSession()
}

async function authHeader(options = {}) {
  const session = options.skipAuthRefresh ? getStoredSession() : await getValidSession()
  return `Bearer ${session?.access_token || getSupabaseAnonKey()}`
}

async function parseResponse(response) {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no esta configurado. Completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  const headers = {
    apikey: getSupabaseAnonKey(),
    Authorization: await authHeader(options),
    ...options.headers,
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const payload = await parseResponse(response)

  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || response.statusText
    if (!options._retriedAfterRefresh && isJwtExpiredMessage(message)) {
      await refreshStoredSession()
      return supabaseRequest(path, { ...options, _retriedAfterRefresh: true })
    }
    throw new Error(message)
  }

  return payload
}

export async function signInWithPassword(email, password) {
  const session = await supabaseRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    skipAuthRefresh: true,
    body: { email, password },
  })
  storeSession(session)
  return session
}

export function signInWithOAuth(provider) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no esta configurado.')
  }
  const redirectTo = `${window.location.origin}/dashboard`
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
  })
  window.location.href = `${getSupabaseUrl()}/auth/v1/authorize?${params.toString()}`
}

export async function consumeOAuthSessionFromUrl() {
  if (typeof window === 'undefined' || !window.location.hash.includes('access_token=')) return null
  const params = new URLSearchParams(window.location.hash.slice(1))
  const accessToken = params.get('access_token')
  if (!accessToken) return null

  const expiresIn = Number(params.get('expires_in') || 3600)
  const session = {
    access_token: accessToken,
    refresh_token: params.get('refresh_token'),
    token_type: params.get('token_type') || 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  }
  storeSession(session)
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)

  try {
    const user = await getAuthUser()
    const hydrated = { ...session, user }
    storeSession(hydrated)
    return hydrated
  } catch {
    return session
  }
}

export async function getAuthUser() {
  return supabaseRequest('/auth/v1/user')
}

export async function signOutSupabase() {
  try {
    if (isSupabaseConfigured() && getStoredSession()?.access_token) {
      await supabaseRequest('/auth/v1/logout', { method: 'POST' })
    }
  } catch {
    // Local logout must still complete if Supabase is unavailable.
  } finally {
    clearStoredSession()
  }
}

export async function selectAll(table, options = {}) {
  const params = new URLSearchParams({ select: '*' })
  if (options.order) params.set('order', options.order)
  return supabaseRequest(`/rest/v1/${table}?${params.toString()}`)
}

export async function insertRow(table, values) {
  return supabaseRequest(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: values,
  })
}

export async function updateById(table, id, values) {
  return supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: values,
  })
}

export async function updateWhere(table, query, values) {
  return supabaseRequest(`/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: values,
  })
}

export async function deleteById(table, id) {
  return supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

export async function callRpc(name, values) {
  return supabaseRequest(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: values,
  })
}
