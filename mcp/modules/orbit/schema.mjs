import { z } from 'zod'

export const id = z.string().regex(/^[a-zA-Z0-9]{15}$/, 'ID de PocketBase de 15 caracteres')
const relation = id.or(z.literal(''))
const text = z.string().max(5000)
const name = z.string().trim().min(1).max(200)
const money = z.number().finite().min(0).max(999999999.99).multipleOf(0.01)
const date = z.string().max(40).refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v))), 'Fecha ISO o vacío')
const cycle = z.enum(['none', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'one_time'])
const receipt = z.object({ month: z.number().int().min(1).max(120), amount: money.positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict()
const define = (fields, operations = 'list,get,create,update,delete') => ({ fields, operations: operations.split(',') })

// Only business fields are writable. Workspace, ownership and system fields are assigned by the service.
export const entities = {
  clients: define({ name, legal_name: text, tax_id: text, contact: text, email: text, phone: text, address: text,
    status: z.enum(['lead', 'contacted', 'proposal', 'active', 'inactive', 'lost']), type: text, color: text, last_contact: date,
    sales_rep_id: relation, billing_cycle: cycle, billing_amount: money, revenue: money, pending: money }),
  sales_reps: define({ name, email: text, phone: text, notes: text }),
  expenses: define({ name, supplier: z.string().max(200), category: z.enum(['software', 'infrastructure', 'services', 'marketing', 'office', 'taxes', 'other']),
    net_amount: money, vat_type: z.enum(['rate', 'exempt', 'not_subject', 'reverse_charge']), vat_rate: z.number().min(0).max(100).multipleOf(0.01),
    billing_cycle: cycle.exclude(['none']), status: z.enum(['active', 'paused']), charge_date: date, notes: text }),
  sales_commissions: define({ client_id: id, sales_rep_id: id, plan: z.enum(['basic', 'pro', 'business', 'custom']), monthly_amount: money,
    bonus_multiplier: z.number().min(0).max(10).multipleOf(0.01), rate: z.number().min(0).max(100).multipleOf(0.01),
    first_month: z.number().int().min(1).max(120), last_month: z.number().int().min(1).max(120),
    start_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), status: z.enum(['active', 'ended']),
    ended_month: z.number().int().min(0).max(120), receipts: z.array(receipt).max(120) }, 'list,get,create,update'),
  invoices: define({ number: text, client_id: relation, amount: money, status: z.enum(['draft', 'sent', 'pending', 'paid', 'overdue', 'cancelled']), issued: date, due: date, concept: text }),
  payments: define({ invoice_id: relation, client_id: relation, amount: money, method: text, date, status: z.enum(['pending', 'completed', 'failed', 'refunded']) }),
  subscriptions: define({ client_id: relation, plan: name, amount: money, interval: z.enum(['month', 'year']), status: z.enum(['active', 'paused', 'cancelled']), started: date, next_invoice: date }),
  revenue_by_month: define({ month: name, ingresos: money, recurrente: money, sort_order: z.number().int() }),
  servers: define({ name, provider: text, ip: text, location: text, os: text, domains: z.array(z.string().max(500)).max(100), services: z.array(z.string().max(500)).max(100) }, 'list,get,create,delete'),
  server_metrics: define({ server_id: id, checked_at: date, cpu: z.number(), ram: z.number(), disk: z.number() }, 'list,get'),
  credentials: define({ name, category: z.enum(['email', 'supabase', 'hosting', 'github', 'domain', 'database', 'api', 'social', 'other']), site: text, username: text, email: text, password: text, recovery: text, notes: text }),
  notifications: define({ read: z.boolean(), title: text, body: text, type: text, href: text }, 'list,get,update,delete'),
  activity: define({ actor_id: relation, type: text, text, detail: text }, 'list,get'),
  integrations: define({ name, description: text, connected: z.boolean() }),
}

export const profileSchema = z.object({ name: name.optional(), bio: text.optional(), phone: text.optional(), location: text.optional(), avatar_url: text.optional() }).strict()
export const organizationSchema = z.object({ name: name.optional(), cif: text.optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional() }).strict()
export const preferencesSchema = z.object({ notifications: z.object({ email: z.boolean().optional(), push: z.boolean().optional(), servers: z.boolean().optional(), billing: z.boolean().optional(), weekly: z.boolean().optional() }).strict().optional(), theme: z.enum(['light', 'dark', 'system']).optional() }).strict()

export function dataSchema(entity, operation) {
  let fields = entities[entity].fields
  if (entity === 'notifications') fields = { read: z.boolean() }
  if (entity === 'sales_commissions' && operation === 'update') fields = Object.fromEntries(Object.entries(fields).filter(([key]) => !['client_id', 'sales_rep_id'].includes(key)))
  let schema = z.object(fields).partial().strict()
  if (operation === 'create') {
    const required = {
      clients: ['name'], sales_reps: ['name'], credentials: ['name'], servers: ['name'], integrations: ['name'], subscriptions: ['plan'], revenue_by_month: ['month'],
      expenses: ['name', 'category', 'net_amount', 'vat_type', 'vat_rate', 'billing_cycle', 'status'],
      sales_commissions: ['client_id', 'sales_rep_id', 'plan', 'monthly_amount', 'bonus_multiplier', 'rate', 'first_month', 'last_month', 'start_month', 'status', 'receipts'],
    }[entity] || []
    schema = schema.required(Object.fromEntries(required.map((key) => [key, true])))
  }
  return schema.refine((v) => Object.keys(v).length > 0, 'Indica al menos un campo')
}

export function listSchema(entity) {
  const fields = ['id', 'created', 'updated', ...Object.keys(entities[entity].fields).filter((key) => !['password', 'recovery', 'notes'].includes(key))]
  const field = z.enum(fields)
  return z.object({ page: z.number().int().min(1).max(100000).default(1), per_page: z.number().int().min(1).max(100).default(50),
    filters: z.array(z.object({ field, operator: z.enum(['eq', 'ne', 'contains', 'gt', 'gte', 'lt', 'lte']), value: z.union([z.string().max(500), z.number().finite(), z.boolean()]) }).strict()).max(20).default([]),
    sort: z.array(z.object({ field, direction: z.enum(['asc', 'desc']).default('asc') }).strict()).max(3).default([]),
  }).strict()
}
