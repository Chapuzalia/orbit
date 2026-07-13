'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { MobileSidebar } from '@/components/mobile-sidebar'
import { AppHeader } from '@/components/app-header'
import { CommandPalette } from '@/components/command-palette'
import { AppDataProvider } from '@/lib/data-context'
import { handleAuthRedirect, isAuthenticated } from '@/lib/auth'

export function AppShell({ children }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function init() {
      try {
        await handleAuthRedirect()
      } catch {
        if (active) router.replace('/login?auth_error=authentik')
        return
      }
      if (!active) return
      if (!isAuthenticated()) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    }

    init()
    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <AppDataProvider>
      <div className="flex min-h-svh bg-background">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            onOpenSidebar={() => setMobileOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </AppDataProvider>
  )
}
