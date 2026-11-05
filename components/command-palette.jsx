'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
import { useAppData } from '@/lib/data-context'
import { cn } from '@/lib/utils'

// Lower-case and drop accents so "martinez" finds "Martínez".
const fold = (text) => (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function CommandPalette({ open, onOpenChange }) {
  const router = useRouter()
  const { clients, salesReps } = useAppData()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const q = fold(query.trim())
    const nav = NAV_ITEMS.map((n) => ({ type: 'Página', label: n.label, href: n.href, search: [n.label] }))
    const cli = clients.map((c) => ({
      type: 'Cliente',
      label: c.name,
      detail: [c.legalName !== c.name && c.legalName, c.contact, c.email].filter(Boolean).join(' · '),
      href: `/clients/${c.id}`,
      search: [c.name, c.legalName, c.contact, c.email, c.taxId, c.phone],
    }))
    const reps = salesReps.map((rep) => ({
      type: 'Comercial',
      label: rep.name,
      detail: [rep.email, rep.phone].filter(Boolean).join(' · '),
      href: `/sales-reps?q=${encodeURIComponent(rep.name)}`,
      search: [rep.name, rep.email, rep.phone],
    }))
    if (!q) return nav
    const words = q.split(/\s+/)
    // Every word must appear in some field, so "acme maria" finds Acme's contact María.
    const hit = (r) => { const text = fold(r.search.filter(Boolean).join(' ')); return words.every((w) => text.includes(w)) }
    return [...cli.filter(hit), ...reps.filter(hit), ...nav.filter(hit)].slice(0, 12)
  }, [clients, salesReps, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  // Focus before paint so keys typed right after ⌘K land in the input.
  useLayoutEffect(() => {
    if (!open) return
    setQuery('')
    inputRef.current?.focus()
  }, [open])

  function go(item) {
    if (!item) return
    onOpenChange(false)
    router.push(item.href)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    } else if (e.key === 'ArrowDown') {
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
      className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en el workspace"
    >
      <div
        className="modal w-full max-w-xl overflow-hidden rounded-[22px] border border-border bg-popover shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, clientes, comerciales…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>
        <ul className="command-results max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sin resultados.
            </li>
          )}
          {results.map((item, i) => (
            <li key={item.href}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm',
                  active === i ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {item.type}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                  </span>
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
