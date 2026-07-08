import { cn } from '@/lib/utils'
import { initials } from '@/lib/format'

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ name = '', color, size = 'sm', className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color || 'oklch(0.54 0.21 268)' }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}

export function AvatarGroup({ members = [], max = 4, size = 'sm' }) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((m) => (
        <Avatar key={m.id} name={m.name} color={m.color} size={size} />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background',
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
