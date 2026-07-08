'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastContext = createContext(null)

const TONE = {
  success: { icon: CheckCircle2, cls: 'text-success' },
  info: { icon: Info, cls: 'text-info' },
  warning: { icon: AlertTriangle, cls: 'text-warning' },
  error: { icon: AlertTriangle, cls: 'text-destructive' },
}

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, tone = 'info' }) => {
      const id = ++idCounter
      setToasts((prev) => [...prev, { id, title, description, tone }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const { icon: Icon, cls } = TONE[t.tone] || TONE.info
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in"
              role="status"
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', cls)} />
              <div className="flex-1">
                {t.title && <p className="text-sm font-medium text-popover-foreground">{t.title}</p>}
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Cerrar notificación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { toast: () => {} }
  return ctx
}
