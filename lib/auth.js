'use client'

import {
  clearStoredSession,
  consumeOAuthSessionFromUrl,
  getStoredSession,
  signInWithOAuth,
  signInWithPassword,
  signOutSupabase,
} from '@/lib/supabase-client'

const AUTHENTIK_PROVIDER = 'custom:authentik'

export async function login(email, password) {
  return signInWithPassword(email, password)
}

export const signIn = login

export function loginWithProvider(provider) {
  return signInWithOAuth(provider)
}

export function loginWithAuthentik() {
  return loginWithProvider(AUTHENTIK_PROVIDER)
}

export async function handleAuthRedirect() {
  return consumeOAuthSessionFromUrl()
}

export async function logout() {
  await signOutSupabase()
}

export const signOut = logout

export function getSession() {
  return getStoredSession()
}

export function isAuthenticated() {
  return Boolean(getStoredSession()?.access_token)
}

export function getCurrentUser() {
  const user = getStoredSession()?.user
  if (!user) return null
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
    email: user.email,
    avatar: user.user_metadata?.avatar_url,
  }
}

export function clearSession() {
  clearStoredSession()
}
