import { cn } from '@/lib/utils'

// Semantic tones map to design tokens defined in globals.css
const TONES = {
  primary: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
  success: 'bg-success/10 text-success ring-1 ring-inset ring-success/25',
  warning: 'bg-warning/15 text-warning-foreground ring-1 ring-inset ring-warning/30 dark:text-warning',
  destructive: 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25',
  info: 'bg-info/10 text-info ring-1 ring-inset ring-info/25',
  purple: 'bg-purple/10 text-purple ring-1 ring-inset ring-purple/25',
  muted: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
  outline: 'text-foreground ring-1 ring-inset ring-border',
}

export function Badge({ className, tone = 'muted', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone] || TONES.muted,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
