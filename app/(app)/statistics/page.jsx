'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { StatisticsChart } from '@/components/statistics-chart'
import { useAppData } from '@/lib/data-context'
import { formatCurrencyPrecise } from '@/lib/format'
import { recurringOverview, forecastMonths, salesRepRanking, expenseCategoryBreakdown, invoiceHistory } from '@/lib/statistics.mjs'
import styles from './statistics.module.css'

const percent = (value) => value == null ? '—' : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)} %`
const linkClass = 'text-sm font-medium text-accent-foreground underline underline-offset-4 dark:text-primary'

export default function StatisticsPage() {
  const { clients, expenses, salesReps, invoices } = useAppData()
  const [now] = useState(() => new Date())
  const [horizon, setHorizon] = useState(6)
  const [draft, setDraft] = useState({ revenueGrowth: '0', costGrowth: '0' })
  const [scenario, setScenario] = useState({ revenueGrowth: 0, costGrowth: 0 })
  const [scenarioError, setScenarioError] = useState('')
  const [rankingSort, setRankingSort] = useState('clients')
  const [historyMonths, setHistoryMonths] = useState(6)
  const overview = useMemo(() => recurringOverview(clients, expenses), [clients, expenses])
  const forecast = useMemo(() => forecastMonths({ clients, expenses, horizon, ...scenario, now }), [clients, expenses, horizon, scenario, now])
  const { ranking, unassigned } = useMemo(() => salesRepRanking(salesReps, clients, rankingSort), [salesReps, clients, rankingSort])
  const categories = useMemo(() => expenseCategoryBreakdown(expenses), [expenses])
  const history = useMemo(() => invoiceHistory(invoices, { months: historyMonths, now }), [invoices, historyMonths, now])
  const historyTotal = history.months.reduce((total, month) => total + Math.round(month.total * 100), 0) / 100
  const forecastProfit = forecast.at(-1)?.cumulative || 0
  const unconfiguredClients = clients.filter((client) => client.status === 'active' && client.billingCycle === 'none').length
  const undatedPunctual = expenses.filter((expense) => expense.status === 'active' && expense.billingCycle === 'one_time' && !expense.chargeDate).length

  function applyScenario(e) {
    e.preventDefault()
    const next = { revenueGrowth: Number(draft.revenueGrowth), costGrowth: Number(draft.costGrowth) }
    if (Object.values(draft).some((value) => value.trim() === '') || Object.values(next).some((value) => !Number.isFinite(value) || value < -100 || value > 100)) {
      setScenarioError('Introduce variaciones mensuales entre −100 % y 100 %.')
      return
    }
    setScenarioError('')
    setScenario(next)
  }

  return (
    <div className={`${styles.surface} space-y-6`}>
      <PageHeader title="Estadísticas" description="Rentabilidad, previsión y cartera comercial"
        actions={<Link href="/expenses" className={linkClass}>Gestionar gastos</Link>} />

      <section className="space-y-3" aria-labelledby="recurring-title">
        <h2 id="recurring-title" className="font-semibold">Balance recurrente actual</h2>
        <p className="text-sm text-muted-foreground">Equivalentes mensuales de contratos y gastos activos, sin IVA. El beneficio operativo estimado es ingresos menos gastos, antes de impuestos sobre beneficios.</p>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Ingresos recurrentes · MRR" value={formatCurrencyPrecise(overview.revenue)} detail={`${overview.recurringClients} clientes recurrentes · ARR ${formatCurrencyPrecise(overview.annualRevenue)}`} />
          <Kpi label="Gastos recurrentes sin IVA" value={formatCurrencyPrecise(overview.costs)} detail={`${overview.recurringCosts} gastos activos · ${formatCurrencyPrecise(overview.annualCosts)} al año`} />
          <Kpi label="Beneficio operativo estimado" value={formatCurrencyPrecise(overview.profit)} negative={overview.profit < 0} detail="Mensual · excluye operaciones puntuales" />
          <Kpi label="Margen operativo estimado" value={percent(overview.margin)} negative={overview.margin < 0} detail={overview.margin == null ? 'Sin ingresos recurrentes para calcular el margen' : 'Beneficio recurrente / ingresos recurrentes'} />
        </dl>
        {unconfiguredClients > 0 && <p className="text-xs text-muted-foreground">{unconfiguredClients} {unconfiguredClients === 1 ? 'cliente activo sin ciclo de facturación configurado' : 'clientes activos sin ciclo de facturación configurado'}. <Link className={linkClass} href="/clients">Revisar clientes</Link></p>}
      </section>

      <Card className="min-w-0 space-y-5 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-semibold">Previsión de ingresos, gastos y resultado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Próximos meses completos · importes sin IVA</p>
          </div>
          <div className="w-full space-y-1.5 sm:w-40">
            <Label htmlFor="forecast-horizon">Horizonte</Label>
            <Select id="forecast-horizon" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></Select>
          </div>
        </div>
        <form onSubmit={applyScenario} className="space-y-3">
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
            <ScenarioInput id="revenue-growth" label="Variación mensual de ingresos (%)" value={draft.revenueGrowth} onChange={(value) => setDraft((prev) => ({ ...prev, revenueGrowth: value }))} />
            <ScenarioInput id="cost-growth" label="Variación mensual de gastos (%)" value={draft.costGrowth} onChange={(value) => setDraft((prev) => ({ ...prev, costGrowth: value }))} />
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1">
              <Button type="submit" className="text-foreground dark:text-primary-foreground">Aplicar escenario</Button>
              <Button type="button" variant="outline" onClick={() => { setDraft({ revenueGrowth: '0', costGrowth: '0' }); setScenario({ revenueGrowth: 0, costGrowth: 0 }); setScenarioError('') }}>Restablecer</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground" role="status">Escenario aplicado: ingresos {percent(scenario.revenueGrowth)} / mes; gastos {percent(scenario.costGrowth)} / mes. Con 0 % se mantienen los contratos actuales.</p>
          {scenarioError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{scenarioError}</p>}
        </form>
        <StatisticsChart data={forecast} />
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Resultado acumulado estimado en {horizon} meses</p>
          <p className={`mt-1 break-words text-2xl font-semibold tabular-nums ${forecastProfit < 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{formatCurrencyPrecise(forecastProfit)}</p>
        </div>
        <TableScroll label="Detalle mensual de la previsión">
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">Detalle mensual de la previsión sin IVA</caption>
            <thead><tr><Th>Mes</Th><Th numeric>Ingresos</Th><Th numeric>Gastos recurrentes</Th><Th numeric>Gastos puntuales</Th><Th numeric>Resultado</Th></tr></thead>
            <tbody>{forecast.map((month) => <tr key={month.key} className="border-b border-border last:border-0">
              <Td>{month.month}</Td><Td numeric>{formatCurrencyPrecise(month.revenue)}</Td><Td numeric>{formatCurrencyPrecise(month.recurringCosts)}</Td><Td numeric>{formatCurrencyPrecise(month.punctualCosts)}</Td><Td numeric negative={month.profit < 0}>{formatCurrencyPrecise(month.profit)}</Td>
            </tr>)}</tbody>
          </table>
        </TableScroll>
        <p className="text-xs text-muted-foreground">Estimación por contratos: los ciclos recurrentes se prorratean por mes. Incluye gastos puntuales activos en su fecha prevista. Excluye ingresos puntuales, clientes no activos y gastos pausados. No representa fechas reales de cobro o pago ni una predicción de nuevas ventas.</p>
        {undatedPunctual > 0 && <p className="text-xs text-muted-foreground">{undatedPunctual} {undatedPunctual === 1 ? 'gasto puntual sin fecha prevista queda fuera' : 'gastos puntuales sin fecha prevista quedan fuera'} de la previsión. <Link className={linkClass} href="/expenses">Revisar gastos</Link></p>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="min-w-0 space-y-4 p-4 sm:p-5">
          <h2 className="font-semibold">Comerciales: cartera actual</h2>
          <p className="text-sm text-muted-foreground">Compara clientes asignados, clientes activos y MRR. El ranking refleja la asignación actual, no el historial de captaciones.</p>
          <div className="max-w-xs space-y-1.5"><Label htmlFor="ranking-sort">Ordenar comerciales por</Label><Select id="ranking-sort" value={rankingSort} onChange={(e) => setRankingSort(e.target.value)}><option value="clients">Clientes asignados</option><option value="active">Clientes activos</option><option value="mrr">MRR de su cartera</option></Select></div>
          {ranking.length === 0 && <p className="text-sm text-muted-foreground">No hay comerciales registrados. <Link href="/sales-reps" className={linkClass}>Gestionar comerciales</Link></p>}
          <TableScroll label="Ranking de comerciales">
            <table className="w-full min-w-[440px] text-sm">
              <caption className="sr-only">Ranking por cartera actual de comerciales</caption>
              <thead><tr><Th>Comercial</Th><Th numeric>Clientes</Th><Th numeric>Activos</Th><Th numeric>MRR sin IVA</Th></tr></thead>
              <tbody>{ranking.map((rep, index) => <tr key={rep.id} className="border-b border-border"><Td><span className="mr-2 text-muted-foreground">{index + 1}.</span><span className="break-words">{rep.name}</span></Td><Td numeric>{rep.clients}</Td><Td numeric>{rep.active}</Td><Td numeric>{formatCurrencyPrecise(rep.mrr)}</Td></tr>)}</tbody>
              <tfoot><tr className="bg-muted/30"><Td>Sin comercial</Td><Td numeric>{unassigned.clients}</Td><Td numeric>{unassigned.active}</Td><Td numeric>{formatCurrencyPrecise(unassigned.mrr)}</Td></tr></tfoot>
            </table>
          </TableScroll>
        </Card>
        <Card className="min-w-0 space-y-4 p-4 sm:p-5">
          <h2 className="font-semibold">Dónde se concentran los gastos</h2>
          <p className="text-sm text-muted-foreground">Gasto recurrente mensual sin IVA, por categoría.</p>
          {categories.length === 0 ? <p className="text-sm text-muted-foreground">No hay gastos recurrentes activos.</p> : <ul className="divide-y divide-border">{categories.map((category) => <li key={category.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-medium">{category.name}</h3><p className="mt-1 text-xs text-muted-foreground">{category.count} {category.count === 1 ? 'gasto' : 'gastos'} · {percent(category.share)} del coste anual</p></div>
            <span className="text-sm font-semibold tabular-nums">{formatCurrencyPrecise(category.monthly)}</span>
          </li>)}</ul>}
        </Card>
      </div>

      <Card className="min-w-0 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><h2 className="font-semibold">Facturación registrada</h2><p className="mt-1 text-sm text-muted-foreground">Facturas emitidas, agrupadas por mes de emisión. Importes según registro, sin desglose de IVA.</p></div>
          <div className="w-full space-y-1.5 sm:w-48"><Label htmlFor="invoice-period">Periodo de facturas</Label><Select id="invoice-period" value={historyMonths} onChange={(e) => setHistoryMonths(Number(e.target.value))}><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></Select></div>
        </div>
        <p className="text-sm">Total del periodo: <strong className="tabular-nums">{formatCurrencyPrecise(historyTotal)}</strong></p>
        <TableScroll label="Historial de facturación registrada">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Facturación registrada por mes de emisión</caption>
            <thead><tr><Th>Mes</Th><Th numeric>Facturas</Th><Th numeric>Facturado</Th><Th numeric>Facturas pagadas</Th><Th numeric>Pendiente</Th></tr></thead>
            <tbody>{history.months.map((month) => <tr key={month.key} className="border-b border-border last:border-0"><Td>{month.month}</Td><Td numeric>{month.count}</Td><Td numeric>{formatCurrencyPrecise(month.total)}</Td><Td numeric>{formatCurrencyPrecise(month.paid)}</Td><Td numeric>{formatCurrencyPrecise(month.pending)}</Td></tr>)}</tbody>
          </table>
        </TableScroll>
        <p className="text-xs text-muted-foreground">El estado pagado o pendiente es el actual de cada factura. Los borradores y las facturas anuladas quedan fuera. Esta serie no representa el historial de gastos pagados.</p>
        {history.undated > 0 && <p className="text-xs text-muted-foreground">{history.undated} {history.undated === 1 ? 'factura sin fecha de emisión queda fuera' : 'facturas sin fecha de emisión quedan fuera'} de esta serie.</p>}
      </Card>
    </div>
  )
}

function Kpi({ label, value, detail, negative }) {
  return <Card className="min-w-0 p-5"><dt className="text-sm text-muted-foreground">{label}</dt><dd><p className={`mt-2 break-words text-2xl font-semibold tabular-nums ${negative ? 'text-red-700 dark:text-red-300' : ''}`}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></dd></Card>
}

function ScenarioInput({ id, label, value, onChange }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" inputMode="decimal" min="-100" max="100" step="0.01" required value={value} onChange={(e) => onChange(e.target.value)} /></div>
}

function TableScroll({ label, children }) {
  return <div className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" role="region" aria-label={label} tabIndex={0}>{children}</div>
}

function Th({ numeric, children }) {
  return <th scope="col" className={`border-b border-border px-3 py-3 text-xs font-medium text-muted-foreground ${numeric ? 'text-right' : 'text-left'}`}>{children}</th>
}

function Td({ numeric, negative, children }) {
  return <td className={`px-3 py-3 ${numeric ? 'text-right tabular-nums whitespace-nowrap' : 'text-left'} ${negative ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>{children}</td>
}
