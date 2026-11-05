'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, LogOut, Menu, PanelLeft, Plus, Search, Settings, User } from 'lucide-react'
import { CommandPalette } from '@/components/command-palette'
import { CreateClientModal } from '@/components/create-entity-modals'
import { Logo } from '@/components/logo'
import { Avatar } from '@/components/ui/avatar'
import { AppDataProvider, useAppData } from '@/lib/data-context'
import { isAuthenticated, logout } from '@/lib/auth'
import { GO_KEYS, NAV_ITEMS } from '@/lib/constants'
import { getNavBadge } from '@/lib/nav-badges'
import { EASE, play } from '@/lib/motion.mjs'
import { useDashboardMotion } from '@/lib/use-dashboard-motion'

const GROUPS = [...new Set(NAV_ITEMS.map((item) => item.group))].map((label) => ({
  label,
  items: NAV_ITEMS.filter((item) => item.group === label),
}))

const isActive = (pathname, href) => pathname === href || pathname.startsWith(href + '/')

const readCollapsed = () => {
  try {
    return localStorage.getItem('orbit-sidebar') === 'collapsed'
  } catch {
    return false
  }
}

export function AppShell({ children }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
    else setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <AppDataProvider>
      <DashboardShell>{children}</DashboardShell>
    </AppDataProvider>
  )
}

// Shell from TickIT Events (docs/DASHBOARD_LAYOUT.md): sidebar, sticky top bar, content canvas.
function DashboardShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { organization, invoices, servers, notifications } = useAppData()
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const shellRef = useDashboardMotion(pathname)
  const mainRef = useRef(null)
  const sideRef = useRef(null)
  const toggleRef = useRef(null)
  const navData = { invoices, servers, notifications }
  const serverIssues = servers.filter((s) => ['warning', 'critical', 'offline'].includes(s.status)).length

  useEffect(() => {
    try {
      localStorage.setItem('orbit-sidebar', collapsed ? 'collapsed' : 'open')
    } catch {
      // Private mode: the sidebar simply starts expanded next time.
    }
  }, [collapsed])

  // shortcut: the App Router gives no stale page to fade out, so there is no 180ms exit; pages only rise in.
  useLayoutEffect(() => {
    setMobile(false)
    for (const animation of mainRef.current?.getAnimations() || []) animation.cancel()
    window.scrollTo({ top: 0 })
  }, [pathname])

  // The active pill springs to the current item as soon as navigation starts.
  useLayoutEffect(() => {
    const nav = sideRef.current?.querySelector('.side-nav')
    const pill = nav?.querySelector('.side-pill')
    if (!pill) return
    const place = () => {
      const item = nav.querySelector('.side-item[aria-current="page"]')
      if (!item) return (pill.style.opacity = '0')
      if (!pill.dataset.on) pill.style.transition = 'none'
      pill.style.transform = `translateY(${item.offsetTop}px)`
      pill.style.height = `${item.offsetHeight}px`
      pill.style.opacity = '1'
      if (!pill.dataset.on) {
        void pill.offsetWidth
        pill.style.transition = ''
        pill.dataset.on = '1'
      }
    }
    place()
    const resize = new ResizeObserver(place)
    resize.observe(nav)
    return () => resize.disconnect()
  }, [pathname])

  useEffect(() => {
    let g = 0
    const key = (e) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        return setSearchOpen((v) => !v)
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (document.querySelector('.modal')) return
      if (e.key === '[' && innerWidth > 1100) setCollapsed((v) => !v)
      else if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'g') g = performance.now()
      else if (GO_KEYS[e.key] && performance.now() - g < 900) {
        g = 0
        router.push(GO_KEYS[e.key])
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [router])

  useEffect(() => {
    if (!mobile) return
    const side = sideRef.current
    side.querySelector('.side-item')?.focus()
    play(side.querySelectorAll('.side-label, .side-item'), [
      { opacity: 0, transform: 'translateX(-8px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 450, delay: 100, stagger: 15, max: 30, easing: EASE.power3 })
    const close = (e) => {
      if (e.key !== 'Escape') return
      setMobile(false)
      toggleRef.current?.focus()
    }
    addEventListener('keydown', close)
    return () => removeEventListener('keydown', close)
  }, [mobile])

  return (
    <div ref={shellRef} className="app-shell" data-collapsed={collapsed || undefined}>
      <aside
        ref={sideRef}
        className={'sidebar' + (mobile ? ' open' : '')}
        aria-label="Tu workspace"
        {...(mobile ? { role: 'dialog', 'aria-modal': 'true' } : {})}
      >
        <div className="side-brand">
          <Link href="/dashboard" className="logo" aria-label="Orbit, ir al dashboard">
            <Logo />
          </Link>
          <button
            type="button"
            className="side-collapse"
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            aria-pressed={collapsed}
            title="Contraer menú ( [ )"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeft size={17} />
          </button>
        </div>
        <div className="side-workspace">
          <div className="side-badge">
            <span className="workspace-avatar" aria-hidden="true">{organization.name?.[0] || 'O'}</span>
            <span className="min-w-0">
              <b className="truncate">{organization.name}</b>
              Plan {organization.plan}
            </span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          <span className="side-pill" aria-hidden="true" />
          {GROUPS.map((group) => (
            <div className="side-group" role="group" aria-label={group.label} key={group.label}>
              <p className="side-label" aria-hidden="true">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon
                const badge = getNavBadge(item, navData)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="side-item"
                    data-tip={item.label}
                    aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                    onClick={() => setMobile(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="side-item-label">{item.label}</span>
                    {badge && (
                      <span className="side-count" data-tone={badge.tone}>
                        {badge.value}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="side-footer">
          <Link href="/servers" className="side-live" data-tip="Estado de servidores">
            <i className="live-dot" data-tone={serverIssues ? 'warning' : undefined} aria-hidden="true" />
            <span>
              <b>{serverIssues ? `${serverIssues} con incidencias` : 'Infraestructura OK'}</b>
              {servers.length} servidores monitorizados
            </span>
          </Link>
        </div>
      </aside>
      <div className="side-scrim" data-open={mobile || undefined} aria-hidden="true" onClick={() => setMobile(false)} />
      <div className="app-body">
        <header className="dashboard-topbar">
          <button
            ref={toggleRef}
            type="button"
            className="top-menu"
            aria-label="Abrir menú"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <button type="button" className="top-search" aria-label="Buscar en el workspace" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
            <span>Buscar…</span>
            <kbd>⌘K</kbd>
          </button>
          <span className="top-spacer" />
          <Clock />
          <button type="button" className="top-create" onClick={() => setCreateOpen(true)}>
            <Plus size={18} aria-hidden="true" />
            <span>Nuevo cliente</span>
          </button>
          <NotificationsLink count={notifications.filter((n) => !n.read).length} />
          <AccountMenu />
        </header>
        <main ref={mainRef} className="dashboard-main">
          {children}
        </main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateClientModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function NotificationsLink({ count }) {
  return (
    <Link
      href="/notifications"
      className="top-icon"
      aria-label={count ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
    >
      <Bell size={18} aria-hidden="true" />
      {count > 0 && <span className="top-dot" aria-hidden="true" />}
    </Link>
  )
}

function AccountMenu() {
  const router = useRouter()
  const { currentUser: user } = useAppData()
  const ref = useRef(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const details = ref.current
    const outside = (e) => {
      if (details.open && !details.contains(e.target)) details.open = false
    }
    const escape = (e) => {
      if (e.key !== 'Escape' || !details.open) return
      details.open = false
      details.querySelector('summary').focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  const close = () => (ref.current.open = false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await logout()
    router.replace('/login')
  }

  return (
    <details ref={ref} className="dashboard-account">
      <summary aria-label="Menú de cuenta">
        <Avatar name={user?.name} color={user?.color} className="avatar h-[42px] w-[42px] ring-0" />
      </summary>
      <div className="dashboard-dropdown">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <hr />
        <Link href="/profile" onClick={close}>
          <User size={16} aria-hidden="true" /> Perfil
        </Link>
        <Link href="/settings" onClick={close}>
          <Settings size={16} aria-hidden="true" /> Ajustes
        </Link>
        <hr />
        <button type="button" className="danger" onClick={handleLogout} disabled={loggingOut}>
          <LogOut size={16} aria-hidden="true" />
          {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </details>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const day = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <span className="top-clock">
      <span>{day}</span>
      {/* Keyed by the minute so the flash replays each time the clock ticks over. */}
      <b key={time}>{time}</b>
    </span>
  )
}
