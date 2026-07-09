'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Dropdown({ trigger, children, align = 'end', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-52 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({
  className,
  icon: Icon,
  children,
  onClick,
  onSelect,
  destructive = false,
  disabled = false,
  type = 'button',
  ...props
}) {
  const handleClick = (event) => {
    onClick?.(event)
    if (!event.defaultPrevented) {
      onSelect?.(event)
    }
  }

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      {children}
    </button>
  )
}

export function DropdownLabel({ children }) {
  return <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</p>
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-border" />
}
