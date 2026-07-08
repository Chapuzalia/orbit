import { cn } from '@/lib/utils'

export function Logo({ className, showText = true, textClassName }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <ellipse cx="12" cy="12" rx="9" ry="4.2" stroke="currentColor" strokeWidth="1.6" />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="4.2"
            stroke="currentColor"
            strokeWidth="1.6"
            transform="rotate(60 12 12)"
          />
        </svg>
      </div>
      {showText && (
        <span className={cn('text-lg font-semibold tracking-tight', textClassName)}>Orbit</span>
      )}
    </div>
  )
}
