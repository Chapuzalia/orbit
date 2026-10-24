import { z } from 'zod'

export const uuid = z.string().uuid()
export const name = z.string().trim().min(1).max(120)
export const text = z.string().max(5000)
export const sortOrder = z.number().int().min(0).max(2147483647)
export const cents = z.number().int().min(0).max(2147483647)
export const rate = z.number().min(0).max(100).multipleOf(0.01)
export const venueInput = { venue_id: uuid.optional().describe('Local de destino. Sin filtro, las listas consultan todos los locales de la plataforma.') }
export const tenantInput = { tenant_id: uuid.optional().describe('Empresa de destino o filtro opcional; no limita los permisos del superadmin.') }
export const confirmInput = { confirm: z.literal(true) }
const base = { name, is_active: z.boolean(), sort_order: sortOrder }
const entity = (fields, required = [], scope = 'venue', relations = {}, operations = ['list', 'get', 'create', 'update', 'delete']) => ({ fields, required, scope, relations, operations })
const read = (columns, scope = 'venue', hasId = true) => ({ fields: {}, required: [], scope, relations: {}, operations: hasId ? ['list', 'get'] : ['list'], columns: columns.split(',') })

// Business fields only. Scope, IDs and timestamps cannot be supplied through data.
export const entities = {
  tenants: entity({ name, slug: z.string().regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/).max(120), is_active: z.boolean(), max_venues: z.number().int().min(1).max(100000), max_devices: z.number().int().min(0).max(100000) }, ['name', 'slug'], 'platform'),
  platform_features: read('key,name,description,is_core,is_active,enabled_by_default,sort_order', 'platform', false),
  venues: entity({ ...base, name: name.max(80), address: z.string().max(300).nullable(), legal_name: z.string().max(80).nullable(), tax_id: z.string().max(80).nullable(),
    timezone: z.string().max(80).refine((v) => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true } catch { return false } }),
    default_tax_rate: rate, day_change_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).nullable(),
  }, ['name'], 'venues', {}, ['list', 'get', 'create', 'update']),
  devices: entity({ name, is_active: z.boolean(), device_mode: z.enum(['satellite', 'checkout', 'hybrid', 'kds']), default_cash_register_id: uuid.nullable(), production_destination_id: uuid.nullable(),
    can_take_orders: z.boolean(), can_take_payments: z.boolean(), can_open_cash_session: z.boolean(), can_close_cash_session: z.boolean(), can_manage_cash: z.boolean(),
  }, ['name', 'device_mode'], 'venue', { default_cash_register_id: 'cash_registers', production_destination_id: 'production_destinations' }, ['list', 'get', 'create', 'update']),
  cash_registers: entity(base, ['name'], 'venue', {}, ['list', 'get', 'create', 'update']),
  dining_areas: entity({ ...base, canvas_width: z.number().int().min(320).max(4000), canvas_height: z.number().int().min(320).max(4000) }, ['name']),
  restaurant_tables: entity({ ...base, area_id: uuid, capacity: z.number().int().min(1).max(99), shape: z.enum(['square', 'rectangle', 'round']),
    position_x: z.number().min(0).max(100), position_y: z.number().min(0).max(100), width: z.number().min(4).max(100), height: z.number().min(4).max(100),
  }, ['name', 'area_id'], 'venue', { area_id: 'dining_areas' }, ['list', 'get', 'create', 'update']),
  customers: entity({ legal_name: name, tax_id: z.string().trim().min(5).max(80), address: name, postal_code: name.max(30), city: name, province: name, country: name,
    email: z.string().email().nullable(), phone: z.string().max(100).nullable(),
  }, ['legal_name', 'tax_id', 'address', 'postal_code', 'city', 'province'], 'tenant', {}, ['list', 'get', 'create', 'update']),
  suppliers: entity({ name: name.max(160), tax_id: z.string().max(80).nullable() }, ['name'], 'venue', {}, ['list', 'get', 'create', 'update']),
  inventory_units: entity({ ...base, symbol: name.max(12), decimal_places: z.number().int().min(0).max(6), content_quantity: z.number().positive().max(1e9), content_unit_id: uuid.nullable() }, ['name', 'symbol'], 'venue', { content_unit_id: 'inventory_units' }),
  inventory_warehouses: entity({ ...base, description: z.string().max(240) }, ['name'], 'venue', {}, ['list', 'get', 'create', 'update']),
  production_destinations: entity({ ...base, kds_enabled: z.boolean(), printer_id: z.string().max(200).nullable() }, ['name'], 'venue', {}, ['list', 'get', 'create', 'update']),
  production_passes: entity(base, ['name'], 'venue', {}, ['list', 'get', 'create', 'update']),
  products: read('id,name,description,product_type,tax_rate,is_active,sort_order'),
  product_variants: read('id,product_id,name,price_cents,sku,is_default,is_active,sort_order,catalog_sale_format_id'),
  catalog_tabs: read('id,key,label,icon,is_active,sort_order'),
  categories: read('id,name,icon,unused,is_active,sort_order'),
  catalog_placements: read('id,product_id,tab_id,category_id,variant_id,is_featured,is_active,sort_order'),
  catalog_tab_categories: read('id,tab_id,category_id,is_active,sort_order'),
  catalog_sale_formats: read('id,name,is_active,sort_order,inventory_consumption_quantity,inventory_consumption_unit_id'),
  selection_groups: read('id,name,kind,is_active,sort_order'),
  selection_group_options: read('id,group_id,product_id,variant_id,supplement_cents,default_quantity,max_quantity,is_active,sort_order'),
  modifier_groups: read('id,name,is_active,sort_order'),
  modifiers: read('id,group_id,name,supplement_cents,is_default,is_active,sort_order'),
  product_selection_group_assignments: read('id,product_id,group_id,min_selection,max_selection,is_active,sort_order'),
  product_modifier_group_assignments: read('id,product_id,group_id,min_selection,max_selection,is_active,sort_order'),
  sales: read('id,ticket_id,cash_session_id,device_id,user_id,total_cents,payment_method,created_at,cash_register_id'),
  tickets: read('id,cash_session_id,device_id,user_id,status,subtotal_cents,total_cents,created_at,cash_register_id'),
  orders: read('id,cash_session_id,guest_count,status,opened_at,closed_at,revision,cash_register_id,order_group_id'),
  order_lines: read('id,order_id,product_id,variant_id,product_name,variant_name,unit_price_cents,quantity,served_quantity,note,created_at'),
  cash_sessions: read('id,status,opened_by,closed_by,opened_at,closed_at,opening_float_cents,expected_cash_cents,counted_cash_cents,discrepancy_cents,cash_register_id'),
  reservations: read('id,customer_name,customer_phone,customer_email,party_size,starts_at,ends_at,status,notes'),
  discounts: read('id,name,type,value,color,is_active,sort_order'),
  inventory_items: read('id,name,description,base_unit_id,is_active,reference_cost'),
  inventory_stock_levels: read('warehouse_id,inventory_item_id,quantity,is_enabled', 'venue', false),
  inventory_stock_movements: read('id,warehouse_id,source_type,stock_quantity_delta,created_at'),
  supplier_documents: read('id,supplier_id,document_type,document_number,document_date,status,processing_mode,affects_stock,stock_applied_at'),
  production_batches: read('id,status,created_at'),
  production_items: read('id,batch_id,destination_id,quantity,ready_quantity,cancelled_quantity'),
  tenant_feature_assignments: read('tenant_id,feature_key', 'tenant', false),
}

export function columnsFor(entityName) {
  const def = entities[entityName]
  return [...new Set(['id', ...(def.scope === 'platform' ? [] : ['tenant_id']), ...(def.scope === 'venue' ? ['venue_id'] : []), ...(def.columns || Object.keys(def.fields))])].filter((key) => key !== 'id' || def.operations.includes('get'))
}
export function entityDataSchema(entityName, operation) {
  const def = entities[entityName]
  const fields = entityName === 'tenants' && operation === 'update' ? Object.fromEntries(Object.entries(def.fields).filter(([key]) => !['max_venues', 'max_devices'].includes(key))) : def.fields
  let schema = z.object(fields).partial().strict()
  if (operation === 'create') schema = schema.required(Object.fromEntries(def.required.map((key) => [key, true])))
  return schema.refine((data) => Object.keys(data).length > 0, 'Indica al menos un campo.')
}
export function listSchema(entityName) {
  const field = z.enum(columnsFor(entityName))
  return z.object({ ...(entities[entityName].scope !== 'platform' ? tenantInput : {}), ...(entities[entityName].scope === 'venue' ? venueInput : {}),
    page: z.number().int().min(1).max(100000).default(1), per_page: z.number().int().min(1).max(100).default(50),
    filters: z.array(z.object({ field, operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']), value: z.union([z.string().max(500), z.number().finite(), z.boolean()]) }).strict()).max(20).default([]),
    sort: z.array(z.object({ field, direction: z.enum(['asc', 'desc']).default('asc') }).strict()).max(3).default([]),
  }).strict()
}

export const userCreateSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(72), full_name: name.optional(), ...tenantInput,
  role: z.enum(['user', 'superadmin', 'owner', 'manager', 'cashier']).default('user'), venue_ids: z.array(uuid).max(100).default([]), device_id: uuid.optional(), email_confirm: z.boolean().default(true), confirm: z.literal(true),
}).strict().superRefine((input, ctx) => {
  if (['owner', 'manager', 'cashier'].includes(input.role) && !input.tenant_id) ctx.addIssue({ code: 'custom', message: 'Indica tenant_id para el acceso a una empresa.' })
  if (['user', 'superadmin'].includes(input.role) && (input.tenant_id || input.device_id || input.venue_ids.length)) ctx.addIssue({ code: 'custom', message: 'La cuenta de plataforma se crea sin membresía. Usa access_grant para asignar empresas.' })
  if (input.role === 'manager' && !input.venue_ids.length) ctx.addIssue({ code: 'custom', message: 'Un manager necesita al menos un local.' })
  if (input.role === 'cashier' && !input.device_id) ctx.addIssue({ code: 'custom', message: 'Un cashier necesita un dispositivo.' })
})
export const userUpdateSchema = z.object({ user_id: uuid, email: z.string().email().max(254).optional(), password: z.string().min(8).max(72).optional(), full_name: name.optional(),
  is_superadmin: z.boolean().optional(), email_confirm: z.boolean().optional(), ban_duration: z.string().regex(/^(none|\d+h)$/).optional(), ...confirmInput }).strict()
export const accessGrantSchema = z.object({ user_id: uuid, tenant_id: uuid, role: z.enum(['owner', 'manager', 'cashier']), venue_ids: z.array(uuid).max(100).default([]), device_id: uuid.optional(), ...confirmInput }).strict().superRefine((input, ctx) => {
  if (input.role === 'manager' && !input.venue_ids.length) ctx.addIssue({ code: 'custom', message: 'Un manager necesita al menos un local.' })
  if (input.role === 'cashier' && !input.device_id) ctx.addIssue({ code: 'custom', message: 'Un cashier necesita un dispositivo.' })
  if (input.role !== 'manager' && input.venue_ids.length) ctx.addIssue({ code: 'custom', message: 'venue_ids solo se aplica a managers.' })
  if (input.role !== 'cashier' && input.device_id) ctx.addIssue({ code: 'custom', message: 'device_id solo se aplica a cashiers.' })
})

export const tenantConfigureSchema = z.object({ tenant_id: uuid, name, slug: entities.tenants.fields.slug,
  max_venues: entities.tenants.fields.max_venues, max_devices: entities.tenants.fields.max_devices,
  feature_keys: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/).max(80)).max(100),
  feature_catalog_version: z.literal(2).default(2), assist_catalog_version: z.literal(1).default(1), ...confirmInput }).strict()
