'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, Bell, LogOut, User, Settings as SettingsIcon, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/dropdown'
import { useAppData } from '@/lib/data-context'
import { logout } from '@/lib/auth'

export function AppHeader({ onOpenSidebar, onOpenSearch }) {
  const router = useRouter()
  const { currentUser: user, notifications } = useAppData()
  const [loggingOut, setLoggingOut] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await logout()
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-sm text-muted-foreground transition-colors hover:bg-accent md:max-w-sm"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />

        <Dropdown
          align="right"
          trigger={
            <span className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </span>
          }
        >
          <div className="px-3 py-2 text-sm font-semibold">Notifications</div>
          <DropdownSeparator />
          {notifications.slice(0, 4).map((n) => (
            <div key={n.id} className="px-3 py-2 text-sm">
              <p className="font-medium leading-tight">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
            </div>
          ))}
          <DropdownSeparator />
          <DropdownItem onSelect={() => router.push('/notifications')}>
            View all notifications
          </DropdownItem>
        </Dropdown>

        <Dropdown
          align="right"
          trigger={
            <span className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
              <Avatar name={user?.name} src={user?.avatar} className="h-8 w-8" />
            </span>
          }
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownSeparator />
          <DropdownItem onSelect={() => router.push('/profile')}>
            <User className="mr-2 h-4 w-4" /> Profile
          </DropdownItem>
          <DropdownItem onSelect={() => router.push('/settings')}>
            <SettingsIcon className="mr-2 h-4 w-4" /> Settings
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={handleLogout} destructive disabled={loggingOut}>
            {loggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            {loggingOut ? 'Cerrando sesion...' : 'Cerrar sesion'}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  )
}
