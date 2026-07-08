import { Badge } from '@/components/ui/badge'
import {
  PROJECT_STATUS,
  PRIORITY,
  TASK_STATUS,
  MEETING_STATUS,
  CLIENT_STATUS,
  SERVER_STATUS,
  INVOICE_STATUS,
  AVAILABILITY,
  PR_STATUS,
} from '@/lib/constants'

const MAPS = {
  project: PROJECT_STATUS,
  priority: PRIORITY,
  task: TASK_STATUS,
  meeting: MEETING_STATUS,
  client: CLIENT_STATUS,
  server: SERVER_STATUS,
  invoice: INVOICE_STATUS,
  availability: AVAILABILITY,
  pr: PR_STATUS,
}

export function StatusBadge({ type = 'project', value, dot = false, className }) {
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
