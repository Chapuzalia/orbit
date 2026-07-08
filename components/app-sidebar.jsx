'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, ChevronDown, Check } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
import { useAppData } from '@/lib/data-context'
import { getNavBadge } from '@/lib/nav-badges'
import { Logo } from '@/components/logo'
import { Avatar } from '@/components/ui/avatar'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown'
import { cn } from '@/lib/utils'

export function AppSidebar({ collapsed, onToggle }) {
  const pathname = usePathname()
  const { organization, currentUser, projects, tasks, invoices, servers, notifications } = useAppData()
  const navData = { projects, tasks, invoices, servers, notifications }

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Brand + workspace */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        {collapsed ? (
          <Logo showText={false} className="mx-auto" />
        ) : (
          <Dropdown
            align="start"
            className="w-56"
            trigger={
              <button className="flex w-full items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent">
                <Logo showText={false} />
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold leading-tight">{organization.name}</p>
                  <p className="text-xs text-muted-foreground">Plan {organization.plan}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            }
          >
            <DropdownLabel>Workspaces</DropdownLabel>
            <DropdownItem>
              <span className="flex-1">{organization.name}</span>
              <Check className="h-4 w-4 text-primary" />
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem>Crear workspace</DropdownItem>
          </Dropdown>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const badge = getNavBadge(item, navData)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && badge && (
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
              {collapsed && badge && (
                <span
                  className={cn(
                    'absolute right-2 top-1.5 h-2 w-2 rounded-full',
                    badge.tone === 'destructive'
                      ? 'bg-destructive'
                      : badge.tone === 'warning'
                        ? 'bg-warning'
                        : 'bg-sidebar-primary',
                  )}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer: user + collapse */}
      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-sidebar-accent',
            collapsed && 'justify-center',
          )}
        >
          <Avatar name={currentUser?.name} color={currentUser?.color} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{currentUser?.name || 'Usuario'}</p>
              <p className="truncate text-xs text-muted-foreground">{currentUser?.role || 'Cuenta'}</p>
            </div>
          )}
        </Link>
        <button
          onClick={onToggle}
          className={cn(
            'mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && 'Contraer'}
        </button>
      </div>
    </aside>
  )
}
