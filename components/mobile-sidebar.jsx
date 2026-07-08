'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
import { useAppData } from '@/lib/data-context'
import { getNavBadge } from '@/lib/nav-badges'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

export function MobileSidebar({ open, onClose }) {
  const pathname = usePathname()
  const { organization, projects, tasks, invoices, servers, notifications } = useAppData()
  const navData = { projects, tasks, invoices, servers, notifications }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  // Close on route change
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <Logo showText={false} />
            <div>
              <p className="text-sm font-semibold leading-tight">{organization.name}</p>
              <p className="text-xs text-muted-foreground">Plan {organization.plan}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent"
            aria-label="Cerrar navegación"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            const badge = getNavBadge(item, navData)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                      badge.tone === 'destructive'
                        ? 'bg-destructive/15 text-destructive'
                        : badge.tone === 'warning'
                          ? 'bg-warning/15 text-warning'
                        : 'bg-sidebar-primary/15 text-sidebar-primary',
                    )}
                  >
                    {badge.value}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
