'use client'

import PocketBase from 'pocketbase'

let client

export function getPocketBaseUrl() {
  return (process.env.NEXT_PUBLIC_POCKETBASE_URL || '').trim().replace(/\/+$/, '')
}

export function isPocketBaseConfigured() {
  return Boolean(getPocketBaseUrl())
}

export function getPocketBase() {
  if (!isPocketBaseConfigured()) throw new Error('Configura NEXT_PUBLIC_POCKETBASE_URL en .env.local.')
  if (!client) {
    client = new PocketBase(getPocketBaseUrl())
    client.autoCancellation(false)
    client.beforeSend = (url, options) => ({
      url, options: { ...options, signal: options.signal || AbortSignal.timeout(15000) },
    })
  }
  return client
}

export function getStoredSession() {
  if (typeof window === 'undefined' || !isPocketBaseConfigured()) return null
  const { authStore } = getPocketBase()
  return authStore.isValid && authStore.record ? { token: authStore.token, user: authStore.record } : null
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return
  if (isPocketBaseConfigured()) getPocketBase().authStore.clear()
  window.localStorage.removeItem('orbit_supabase_session')
  document.cookie = 'orbit_session=; path=/; max-age=0'
}

export async function getAuthUser() {
  try {
    return (await getPocketBase().collection('users').authRefresh()).record
  } catch (error) {
    if ([401, 403, 404].includes(error.status)) {
      clearStoredSession()
      throw new Error('Sesion expirada. Inicia sesion de nuevo.')
    }
    throw error
  }
}

export async function signInWithPassword(email, password) {
  clearStoredSession()
  await getPocketBase().collection('users').authWithPassword(email.trim(), password)
  return getStoredSession()
}

export async function signInWithOAuth(provider) {
  await getPocketBase().collection('users').authWithOAuth2({ provider })
  return getStoredSession()
}

export function normalizeRow(row) {
  const mapped = { ...row, created_at: row.created, updated_at: row.updated }
  for (const [key, value] of Object.entries(mapped)) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
      mapped[key] = new Date(value.replace(' ', 'T')).toISOString()
    }
  }
  return mapped
}

const normalizeBody = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null ? '' : value]))

export async function selectAll(collection, options = {}) {
  const sort = options.order?.split(',').map((part) => {
    const [field, direction] = part.split('.')
    return `${direction === 'desc' ? '-' : ''}${field === 'created_at' ? 'created' : field === 'updated_at' ? 'updated' : field}`
  }).join(',')
  return (await getPocketBase().collection(collection).getFullList({ sort })).map(normalizeRow)
}

export async function insertRow(collection, values) {
  return [normalizeRow(await getPocketBase().collection(collection).create(normalizeBody(values)))]
}

export async function updateById(collection, id, values) {
  return [normalizeRow(await getPocketBase().collection(collection).update(id, normalizeBody(values)))]
}

export async function deleteById(collection, id) {
  await getPocketBase().collection(collection).delete(id)
}

export async function createMonitoredServer(values) {
  return normalizeRow(await getPocketBase().send('/api/orbit/servers', { method: 'POST', body: values }))
}
