'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { PriorityBadge } from '@/components/status-badge'
import { useAppData } from '@/lib/data-context'
import { formatDate, daysUntil } from '@/lib/format'
import { Plus, Check, Users, Lock, Trash2 } from 'lucide-react'

export default function TodosPage() {
  const { todoLists, getMember, toggleTodoItem, addTodoItem, removeTodoItem } = useAppData()
  const [lists, setLists] = useState(todoLists)
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    setLists(todoLists)
  }, [todoLists])

  const toggle = async (listId, itemId) => {
    const item = lists.find((list) => list.id === listId)?.items.find((it) => it.id === itemId)
    if (!item) return
    setLists((prev) =>
      prev.map((l) =>
        l.id !== listId
          ? l
          : { ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)) },
      ),
    )
    try {
      await toggleTodoItem(itemId, !item.done)
    } catch {
      setLists((prev) =>
        prev.map((l) =>
          l.id !== listId
            ? l
            : { ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, done: item.done } : it)) },
        ),
      )
    }
  }

  const remove = async (listId, itemId) => {
    const current = lists
    setLists((prev) =>
      prev.map((l) => (l.id !== listId ? l : { ...l, items: l.items.filter((it) => it.id !== itemId) })),
    )
    try {
      await removeTodoItem(itemId)
    } catch {
      setLists(current)
    }
  }

  const addItem = async (listId) => {
    const text = (drafts[listId] || '').trim()
    if (!text) return
    setDrafts((d) => ({ ...d, [listId]: '' }))
    try {
      await addTodoItem(listId, text)
    } catch {
      setDrafts((d) => ({ ...d, [listId]: text }))
    }
  }

  const totalOpen = lists.reduce((s, l) => s + l.items.filter((i) => !i.done).length, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="To-do lists" description={`${totalOpen} tareas pendientes en ${lists.length} listas`} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => {
          const open = list.items.filter((i) => !i.done).length
          const done = list.items.length - open
          return (
            <Card key={list.id} className="flex h-full flex-col">
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  {list.shared ? (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  {list.name}
                </CardTitle>
                <Badge tone="muted">
                  {done}/{list.items.length}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-1">
                {list.items.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Lista vacía</p>
                )}
                {list.items.map((item) => {
                  const assignee = getMember(item.assigneeId)
                  const overdue = item.due && !item.done && daysUntil(item.due) < 0
                  return (
                    <div key={item.id} className="group flex items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-muted/60">
                      <button
                        onClick={() => toggle(list.id, item.id)}
                        aria-label={item.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                          item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary'
                        }`}
                        style={{ height: '1.15rem', width: '1.15rem' }}
                      >
                        {item.done && <Check className="h-3 w-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug ${item.done ? 'text-muted-foreground line-through' : ''}`}>
                          {item.text}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {!item.done && <PriorityBadge value={item.priority} />}
                          {item.due && (
                            <span className={`text-xs ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {formatDate(item.due)}
                            </span>
                          )}
                        </div>
                      </div>
                      {assignee && <Avatar name={assignee.name} color={assignee.color} size="xs" />}
                      <button
                        onClick={() => remove(list.id, item.id)}
                        aria-label="Eliminar"
                        className="mt-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}

                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addItem(list.id)
                  }}
                >
                  <Input
                    value={drafts[list.id] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [list.id]: e.target.value }))}
                    placeholder="Añadir tarea..."
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Añadir">
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
