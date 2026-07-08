'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { formatTime, formatDate } from '@/lib/format'
import { ChevronLeft, ChevronRight, Video, MapPin, Clock, CheckSquare } from 'lucide-react'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CalendarPage() {
  const { meetings, tasks } = useAppData()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(today)

  const events = useMemo(() => {
    const meetingEvents = meetings.map((m) => ({ kind: 'meeting', date: new Date(m.start), data: m }))
    const taskEvents = tasks
      .filter((t) => t.status !== 'done')
      .map((t) => ({ kind: 'task', date: new Date(t.dueDate), data: t }))
    return [...meetingEvents, ...taskEvents]
  }, [meetings, tasks])

  const grid = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const startOffset = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  const dayEvents = events.filter((e) => sameDay(e.date, selectedDay)).sort((a, b) => a.date - b.date)

  return (
    <div className="space-y-6">
      <PageHeader title="Calendario" description="Reuniones, entregas y vencimientos del equipo" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              >
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mes anterior"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mes siguiente"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[84px] border-b border-r border-border bg-muted/20" />
              const dEvents = events.filter((e) => sameDay(e.date, day))
              const isToday = sameDay(day, today)
              const isSelected = sameDay(day, selectedDay)
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[84px] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-accent/50 ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dEvents.slice(0, 2).map((e, j) => (
                      <div
                        key={j}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                          e.kind === 'meeting'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-chart-4/15 text-foreground'
                        }`}
                      >
                        {e.kind === 'meeting' ? e.data.title : e.data.title}
                      </div>
                    ))}
                    {dEvents.length > 2 && (
                      <div className="px-1 text-[10px] text-muted-foreground">+{dEvents.length - 2} más</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{formatDate(selectedDay, { weekday: 'long' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin eventos este día.</p>
            ) : (
              dayEvents.map((e, i) =>
                e.kind === 'meeting' ? (
                  <MeetingItem key={i} meeting={e.data} />
                ) : (
                  <TaskDeadlineItem key={i} task={e.data} />
                ),
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MeetingItem({ meeting }) {
  const { getClient, getMember } = useAppData()
  const client = getClient(meeting.clientId)
  const attendees = meeting.attendees.map(getMember).filter(Boolean)
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{meeting.title}</span>
        <StatusBadge type="meeting" value={meeting.status} />
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatTime(meeting.start)} · {meeting.duration} min
        </div>
        <div className="flex items-center gap-1.5">
          {meeting.link ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
          {meeting.location}
        </div>
        {client && <div>Cliente: {client.name}</div>}
      </div>
      <div className="mt-2 flex -space-x-2">
        {attendees.map((a) => (
          <Avatar key={a.id} name={a.name} color={a.color} size="sm" />
        ))}
      </div>
    </div>
  )
}

function TaskDeadlineItem({ task }) {
  const { getProject, getMember } = useAppData()
  const project = getProject(task.projectId)
  const assignee = getMember(task.assigneeId)
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-3">
      <CheckSquare className="mt-0.5 h-4 w-4 text-chart-4" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{task.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {project?.name} · entrega
        </div>
      </div>
      {assignee && <Avatar name={assignee.name} color={assignee.color} size="sm" />}
    </div>
  )
}
