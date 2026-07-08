'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Literal color values (SVG fills don't reliably resolve oklch via CSS vars in
// every browser, so we pass concrete colors to Recharts).
export const CHART_COLORS = {
  c1: 'oklch(0.58 0.21 268)',
  c2: 'oklch(0.6 0.16 240)',
  c3: 'oklch(0.62 0.16 150)',
  c4: 'oklch(0.78 0.15 75)',
  c5: 'oklch(0.6 0.22 300)',
}
const PALETTE = [CHART_COLORS.c1, CHART_COLORS.c2, CHART_COLORS.c3, CHART_COLORS.c4, CHART_COLORS.c5]

const axisProps = {
  stroke: 'oklch(0.6 0.02 265)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
}

const grid = <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 265 / 0.5)" vertical={false} />

function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color || p.fill }}
          />
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">
            {prefix}
            {typeof p.value === 'number' ? p.value.toLocaleString('es-ES') : p.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  )
}

// Monthly revenue: { month, ingresos, recurrente }
export function RevenueAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.58 0.21 268)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="oklch(0.58 0.21 268)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.62 0.16 150)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(0.62 0.16 150)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="month" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip content={<ChartTooltip prefix="€" />} />
        <Area
          type="monotone"
          name="Ingresos"
          dataKey="ingresos"
          stroke="oklch(0.58 0.21 268)"
          strokeWidth={2}
          fill="url(#rev)"
        />
        <Area
          type="monotone"
          name="Recurrente"
          dataKey="recurrente"
          stroke="oklch(0.62 0.16 150)"
          strokeWidth={2}
          fill="url(#rec)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Generic categorical bar chart: data of { label, value }
export function CategoryBarChart({ data, suffix = '' }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip cursor={{ fill: 'oklch(0.6 0.02 265 / 0.08)' }} content={<ChartTooltip suffix={suffix} />} />
        <Bar dataKey="value" name="Total" fill="oklch(0.6 0.16 240)" radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Donut chart: data of { name, value, color? }
export function StatusDonutChart({ data }) {
  const palette = [
    'oklch(0.58 0.21 268)',
    'oklch(0.6 0.16 240)',
    'oklch(0.62 0.16 150)',
    'oklch(0.78 0.15 75)',
    'oklch(0.6 0.22 300)',
  ]
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={3}
        >
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.color || palette[i % palette.length]}
              stroke="oklch(1 0 0)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Server metric history: { t, cpu, ram, disk, net }
export function ServerMetricChart({ data, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="t" {...axisProps} interval={3} />
        <YAxis {...axisProps} domain={[0, 100]} />
        <Tooltip content={<ChartTooltip suffix="%" />} />
        <Line type="monotone" name="CPU" dataKey="cpu" stroke="oklch(0.58 0.21 268)" strokeWidth={2} dot={false} />
        <Line type="monotone" name="RAM" dataKey="ram" stroke="oklch(0.78 0.15 75)" strokeWidth={2} dot={false} />
        <Line type="monotone" name="Disco" dataKey="disk" stroke="oklch(0.62 0.16 150)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Mini sparkline area for cards
export function Sparkline({ data, dataKey = 'value', color = 'oklch(0.58 0.21 268)', height = 48 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
