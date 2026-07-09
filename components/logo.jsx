import { cn } from '@/lib/utils'

export function Logo({ className, showText = true, textClassName, markClassName }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white shadow-sm',
          markClassName,
        )}
      >
        <svg viewBox="0 0 40 40" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            fill="var(--brand-navy)"
            d="M18.6 7.9c1.1-2 3.9-2 5.1 0l10.7 18.8c1.1 2-.3 4.5-2.6 4.5h-5.3L15.9 12.4c-1.1-2 .3-4.5 2.7-4.5Z"
          />
          <path
            fill="var(--brand-teal)"
            d="M6.2 29.1l4.5-7.8c1-1.7 3.4-1.7 4.3 0l4.5 7.8c.9 1.7-.3 3.8-2.2 3.8H8.4c-1.9 0-3.1-2.1-2.2-3.8Z"
          />
        </svg>
      </div>
      {showText && (
        <span className={cn('text-lg font-semibold leading-none text-foreground', textClassName)}>Orbit</span>
      )}
    </div>
  )
}
