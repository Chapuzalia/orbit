import { Badge } from '@/components/ui/badge'
import {
  PRIORITY,
  CLIENT_STATUS,
  SERVER_STATUS,
  INVOICE_STATUS,
} from '@/lib/constants'

const MAPS = {
  priority: PRIORITY,
  client: CLIENT_STATUS,
  server: SERVER_STATUS,
  invoice: INVOICE_STATUS,
}

export function StatusBadge({ type = 'client', value, dot = false, className }) {
  const map = MAPS[type] || {}
  const cfg = map[value] || { label: value, tone: 'muted' }
  return (
    <Badge tone={cfg.tone} className={className}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {cfg.label}
    </Badge>
  )
}

export function PriorityBadge({ value, className }) {
  return <StatusBadge type="priority" value={value} className={className} />
}
