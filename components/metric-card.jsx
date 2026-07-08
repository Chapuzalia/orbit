import Link from 'next/link'
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

const ICON_TONE = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning-foreground dark:text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  purple: 'bg-purple/10 text-purple',
  chart2: 'bg-chart-2/15 text-chart-2',
  chart3: 'bg-chart-3/15 text-chart-3',
  chart4: 'bg-chart-4/20 text-chart-4',
}

export function MetricCard({ label, value, icon: Icon, tone = 'primary', delta, deltaTone, href, hint, sub }) {
  const positive = deltaTone ? deltaTone === 'up' : delta && !String(delta).startsWith('-')
  const Trend = positive ? TrendingUp : TrendingDown
  const body = (
    <Card className="group relative p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', ICON_TONE[tone])}>
          {Icon && <Icon className="h-5 w-5" />}
        </div>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {delta != null && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              positive ? 'text-success' : 'text-destructive',
            )}
          >
            <Trend className="h-3.5 w-3.5" />
            {delta}
          </span>
        )}
      </div>
      {(hint || sub) && <p className="mt-1 text-xs text-muted-foreground">{hint || sub}</p>}
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}
