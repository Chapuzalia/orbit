'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppData } from '@/lib/data-context'
import { relativeTime } from '@/lib/format'
import { useToast } from '@/components/ui/toaster'
import {
  Server,
  GitPullRequest,
  Receipt,
  CheckSquare,
  Play,
  Wallet,
  CalendarDays,
  ShieldCheck,
  UserPlus,
  Bell,
  CheckCheck,
} from 'lucide-react'

const ICONS = {
  server: { icon: Server, tone: 'bg-destructive/10 text-destructive' },
  pr: { icon: GitPullRequest, tone: 'bg-chart-2/15 text-chart-2' },
  invoice: { icon: Receipt, tone: 'bg-warning/15 text-warning' },
  task: { icon: CheckSquare, tone: 'bg-primary/10 text-primary' },
  workflow: { icon: Play, tone: 'bg-destructive/10 text-destructive' },
  payment: { icon: Wallet, tone: 'bg-success/10 text-success' },
  meeting: { icon: CalendarDays, tone: 'bg-purple/10 text-purple' },
  ssl: { icon: ShieldCheck, tone: 'bg-warning/15 text-warning' },
  client: { icon: UserPlus, tone: 'bg-info/10 text-info' },
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const { notifications, markNotificationRead, markAllNotificationsRead } = useAppData()
  const [items, setItems] = useState(notifications)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setItems(notifications)
  }, [notifications])

  const unread = items.filter((n) => !n.read).length
  const filtered = filter === 'unread' ? items.filter((n) => !n.read) : items

  const markAllRead = async () => {
    const current = items
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await markAllNotificationsRead()
      toast({ title: 'Notificaciones', description: 'Todas marcadas como leidas.' })
    } catch (err) {
      setItems(current)
      toast({ title: 'No se pudo actualizar', description: err.message || 'Revisa la conexion con Supabase.', tone: 'destructive' })
    }
  }
  const markRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await markNotificationRead(id)
    } catch {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        description={`${unread} sin leer de ${items.length}`}
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Marcar todas
            </Button>
          )
        }
      />

      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'unread', label: `Sin leer (${unread})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Bell className="h-8 w-8" />
              <p className="text-sm">No hay notificaciones {filter === 'unread' ? 'sin leer' : ''}</p>
            </div>
          )}
          {filtered.map((n) => {
            const cfg = ICONS[n.type] || { icon: Bell, tone: 'bg-muted text-muted-foreground' }
            const Icon = cfg.icon
            return (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => markRead(n.id)}
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60 ${!n.read ? 'bg-primary/[0.03]' : ''}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.tone}`}>
                  <Icon className="h-4.5 w-4.5" style={{ height: '1.1rem', width: '1.1rem' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(n.createdAt)}</span>
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
