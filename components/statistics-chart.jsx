'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrencyPrecise } from '@/lib/format'

export function StatisticsChart({ data }) {
  return (
    <div className="h-72 w-full min-w-0" role="img" aria-label="Previsión mensual de ingresos y gastos en barras y resultado en línea. Los valores exactos están en la tabla siguiente.">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={['auto', 'auto']} width={62} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" />
          <Tooltip formatter={(value) => formatCurrencyPrecise(value)} itemStyle={{ color: 'var(--foreground)' }} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)', fontSize: 12 }} />
          <Legend formatter={(value) => <span className="text-foreground">{value}</span>} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar name="Ingresos sin IVA" dataKey="revenue" fill="#2563eb" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar name="Gastos sin IVA" dataKey="costs" fill="#c2410c" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line name="Resultado estimado" dataKey="profit" stroke="#0f766e" strokeWidth={3} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
