'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
import { useAppData } from '@/lib/data-context'
import { cn } from '@/lib/utils'

export function CommandPalette({ open, onOpenChange }) {
  const router = useRouter()
  const { projects, clients } = useAppData()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const nav = NAV_ITEMS.map((n) => ({
      type: 'Page',
      label: n.label,
      href: n.href,
    }))
    const proj = projects.map((p) => ({
      type: 'Project',
      label: p.name,
      href: `/projects/${p.id}`,
    }))
    const cli = clients.map((c) => ({
      type: 'Client',
      label: c.name,
      href: `/clients/${c.id}`,
    }))
    const all = [...nav, ...proj, ...cli]
    if (!q) return all.slice(0, 8)
    return all.filter((r) => r.label.toLowerCase().includes(q)).slice(0, 10)
  }, [clients, projects, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  function go(item) {
    if (!item) return
    onOpenChange(false)
    router.push(item.href)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, projects, clients..."
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found.
            </li>
          )}
          {results.map((item, i) => (
            <li key={`${item.type}-${item.label}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm',
                  active === i ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.type}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
