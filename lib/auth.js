'use client'

import { clearStoredSession, getStoredSession, signInWithOAuth, signInWithPassword } from '@/lib/pocketbase-client'

export const login = signInWithPassword
export const signIn = login
export const loginWithProvider = signInWithOAuth
export const loginWithAuthentik = () => signInWithOAuth(process.env.NEXT_PUBLIC_POCKETBASE_OAUTH_PROVIDER || 'oidc')
export const logout = async () => clearStoredSession()
export const signOut = logout
export const getSession = getStoredSession
export const isAuthenticated = () => Boolean(getStoredSession())
export const clearSession = clearStoredSession

export function getCurrentUser() {
  const user = getStoredSession()?.user
  if (!user) return null
  return { ...user, name: user.name || user.email?.split('@')[0] || 'Usuario', avatar: user.avatar_url }
}
