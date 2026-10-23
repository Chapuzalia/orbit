'use client'

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ExpenseModal } from '@/components/expense-modal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toaster'
import { useAppData } from '@/lib/data-context'
import { EXPENSE_CATEGORIES, EXPENSE_CYCLES, expenseAmounts, expenseVatLabel, recurringExpenses } from '@/lib/expenses.mjs'
import { formatCurrencyPrecise, formatDate } from '@/lib/format'

export default function ExpensesPage() {
  const { expenses, deleteExpense } = useAppData()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [cycle, setCycle] = useState('all')
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const summary = useMemo(() => recurringExpenses(expenses), [expenses])
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es')
    return expenses.filter((expense) => (status === 'all' || expense.status === status) && (category === 'all' || expense.category === category) && (cycle === 'all' || expense.billingCycle === cycle)
      && [expense.name, expense.supplier, expense.notes].some((value) => (value || '').toLocaleLowerCase('es').includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [expenses, query, status, category, cycle])

  async function remove() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await deleteExpense(deleting.id)
      toast({ title: 'Gasto eliminado', description: deleting.name })
      setDeleting(null)
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el gasto. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gastos" description={`${expenses.length} ${expenses.length === 1 ? 'gasto registrado' : 'gastos registrados'} · controla tus costes y próximos cobros`}
        actions={<Button className="text-foreground dark:text-primary-foreground" onClick={() => setEditor({})}><Plus className="h-4 w-4" />Nuevo gasto</Button>} />

      <Card className="p-5">
        <h2 className="font-semibold">Gastos recurrentes</h2>
        <p className="mt-1 text-xs text-muted-foreground">Equivalentes de gastos activos · independientes de los filtros</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <ExpenseSummary title="Mensual" values={summary.monthly} />
          <ExpenseSummary title="Anual" values={summary.annual} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{summary.count} {summary.count === 1 ? 'gasto recurrente activo' : 'gastos recurrentes activos'}. No incluye gastos puntuales ni pausados. Los importes reflejan pagos al proveedor, sin calcular IVA deducible.</p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar gastos" placeholder="Buscar gasto o proveedor…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Filtrar gastos por estado" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="paused">Pausados</option></Select>
        <Select aria-label="Filtrar gastos por categoría" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Todas las categorías</option>{Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select aria-label="Filtrar gastos por ciclo" value={cycle} onChange={(e) => setCycle(e.target.value)}><option value="all">Todos los ciclos</option>{Object.entries(EXPENSE_CYCLES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</Select>
      </div>

      {filtered.length === 0 ? <EmptyState icon={Receipt} title={expenses.length ? 'Sin resultados' : 'Todavía no hay gastos'} description={expenses.length ? 'Prueba con otros filtros o términos de búsqueda.' : 'Registra un gasto con su importe, IVA y ciclo de cobro para empezar.'} /> : (
        <Card className="divide-y divide-border">
          {filtered.map((expense) => {
            const amounts = expenseAmounts(expense)
            return <article key={expense.id} className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-semibold">{expense.name}</h2>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{expense.supplier ? `${expense.supplier} · ` : ''}{EXPENSE_CATEGORIES[expense.category]}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Editar ${expense.name}`} onClick={() => setEditor(expense)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Eliminar ${expense.name}`} onClick={() => { setError(''); setDeleting(expense) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={expense.status === 'active' ? 'success' : 'muted'} className={expense.status === 'active' ? 'text-accent-foreground dark:text-success' : undefined}>{expense.status === 'active' ? 'Activo' : 'Pausado'}</Badge>
                <Badge tone="outline">{EXPENSE_CYCLES[expense.billingCycle]?.label}</Badge>
                <span className="text-muted-foreground">{expense.chargeDate ? `Cobro previsto: ${formatDate(`${expense.chargeDate}T12:00:00`)}` : 'Sin fecha de cobro'}</span>
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Amount label="Base por cobro sin IVA" value={amounts.net} />
                <Amount label={`IVA · ${expenseVatLabel(expense)}`} value={amounts.vat} />
                <Amount label="Total por cobro" value={amounts.total} strong />
              </dl>
              {expense.notes && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{expense.notes}</p>}
            </article>
          })}
        </Card>
      )}
      {editor && <ExpenseModal key={editor.id || 'new'} expense={editor.id ? editor : null} onClose={() => setEditor(null)} />}
      {deleting && <Modal open title="Eliminar gasto" description={`Se eliminará «${deleting.name}» y dejará de incluirse en los totales.`} onClose={() => { if (!busy) setDeleting(null) }}
        footer={<><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Eliminar gasto</Button></>}>
        <p className="text-sm text-muted-foreground">Puedes pausarlo desde Editar si quieres conservarlo fuera de los gastos recurrentes.</p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </Modal>}
    </div>
  )
}

function ExpenseSummary({ title, values }) {
  return <section className="space-y-3">
    <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
    <p className="break-words text-2xl font-semibold tabular-nums">{formatCurrencyPrecise(values.total)} <span className="text-xs font-normal text-muted-foreground">con IVA en factura</span></p>
    <dl className="flex flex-wrap gap-x-6 gap-y-3"><Amount label="Sin IVA" value={values.net} /><Amount label="IVA en factura" value={values.vat} /></dl>
  </section>
}

function Amount({ label, value, strong }) {
  return <div className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 break-words tabular-nums ${strong ? 'font-semibold' : 'text-sm font-medium'}`}>{formatCurrencyPrecise(value)}</dd></div>
}
