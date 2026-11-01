import { z } from 'zod'
import { uuid, confirmInput } from './admin-schema.mjs'

// Mirrors POS _shared/billing/schemas.ts. Economic validation stays in POS.
const quantity = z.number().int().min(0).max(100_000)
const key = z.string().regex(/^[a-z][a-z0-9_]{0,79}$/)
const quantities = z.record(key, quantity)
const reason = z.string().trim().min(1).max(500)
const tenant = { tenant_id: uuid }
const selection = z.object({ planVersionId: uuid, addons: z.array(z.object({
  key, versionId: uuid, quantity, venueIds: z.array(uuid).max(1000), deviceIds: z.array(uuid).max(1000),
}).strict()).max(19) }).strict()
const exception = z.object({
  freeUnits: quantities, limits: z.object({ venues: quantity.optional(), devices: quantity.optional() }).strict(),
  discountBasisPoints: z.number().int().min(0).max(10_000),
  customAmounts: z.record(key, z.number().int().min(0).max(100_000_000)),
  cycles: z.number().int().min(1).max(36).nullable(), reason,
  promotions: z.array(z.object({
    id: uuid, key, freeUnits: quantity.min(1), start: z.enum(['immediate', 'period_end']),
    durationUnit: z.enum(['months', 'cycles']), duration: quantity.min(1).max(36), consent: reason,
    startsAt: z.number().int().positive().optional(), endsAt: z.number().int().positive().optional(), consentRecordedAt: z.string().optional(),
  }).strict()).max(8).optional(),
}).strict()
const product = z.object({
  key, kind: z.enum(['plan', 'addon']), name: z.string().trim().min(1).max(120), description: z.string().max(2000),
  scope: z.enum(['tenant', 'venue', 'device']), featureKey: key.nullable(), resource: z.enum(['venues', 'devices']).nullable(),
  active: z.boolean(), sortOrder: z.number().int().min(0).max(10000),
}).strict()
const version = z.object({
  interval: z.enum(['month', 'year']), amountCents: z.number().int().min(0).max(100_000_000), features: z.array(key).max(100),
  limits: z.object({ venues: quantity.min(1), devices: quantity }).strict(), included: quantities, maximum: quantity.nullable(), requires: z.array(key).max(20),
}).strict()
const command = (action, fields, description, readOnly = false) => ({ action, schema: z.object({ ...fields, ...(readOnly ? {} : confirmInput) }).strict(), description, readOnly })
export const billingCommands = {
  catalog: command('catalog', {}, 'Consulta productos, tarifas versionadas y funcionalidades disponibles.', true),
  overview: command('overview', {}, 'Consulta estados, MRR/ARR, cobros y supervisión global.', true),
  get: command('get', tenant, 'Consulta contrato, derechos, recursos, facturas, operaciones y auditoría. Puede inicializar la cuenta interna; requiere confirm=true.'),
  catalog_save: command('catalog-save', { product, version: version.nullable(), reason }, 'Guarda un producto y una nueva tarifa inmutable. Importes en céntimos; no modifica contratos existentes.'),
  catalog_publish: command('catalog-publish', { version_id: uuid }, 'Publica una tarifa en Stripe sandbox; usa el ID devuelto por catalog_save.'),
  quote: command('quote', { ...tenant, selection, exception: exception.nullable(), reason }, 'Prepara un presupuesto persistido de plan y addons, asignaciones, límites y excepciones/promociones. No contrata: revisa importe y vigencia antes de billing_confirm. exception=null sigue las reglas de conservación de acuerdos de POS.'),
  quote_cancel: command('quote-cancel', { ...tenant, immediate: z.boolean(), reason }, 'Previsualiza cancelación inmediata o al vencimiento; no cancela hasta billing_confirm.'),
  confirm: command('confirm', { ...tenant, operation_id: uuid }, 'Confirma el presupuesto vigente por su ID y empresa. Puede crear Checkout o cobrar/cambiar una suscripción existente. Conserva el mismo operation_id ante resultado incierto.'),
  portal: command('portal', tenant, 'Crea enlace temporal al Portal de Stripe para datos fiscales, métodos de pago e histórico. Los cambios de contrato se gestionan en Tickit.'),
  settings: command('settings', { ...tenant, grace_days: quantity.max(365), legal_name: z.string().max(200), tax_id: z.string().max(40), email: z.string().email().or(z.literal('')), reason }, 'Configura ficha interna de facturación y días de gracia; no cambia datos fiscales de un cliente Stripe existente.'),
  reconcile: command('reconcile', tenant, 'Concilia con Stripe y actualiza la proyección local. Comprueba después contrato, derechos y estado de pago.'),
  reconcile_batch: command('reconcile-batch', {}, 'Concilia un lote de hasta veinte cuentas con cliente Stripe; informa fallos por empresa.'),
  retry_operation: command('retry-operation', { ...tenant, operation_id: uuid }, 'Recupera una operación con su ID y claves de idempotencia originales. No crea un presupuesto sustituto; respeta la ventana de recuperación de POS.'),
  retry_event: command('retry-event', { event_id: z.string().regex(/^evt_/).max(150) }, 'Reintenta un evento fallido registrado en Tickit consultando el estado actual de Stripe.'),
}

const backendKeys = { tenant_id: 'tenantId', version_id: 'versionId', operation_id: 'operationId', event_id: 'eventId', grace_days: 'graceDays', legal_name: 'legalName', tax_id: 'taxId' }
export function billingBody(commandName, input) {
  const def = billingCommands[commandName]
  const parsed = def.schema.parse(input)
  return { action: def.action, ...Object.fromEntries(Object.entries(parsed).filter(([field]) => field !== 'confirm').map(([field, value]) => [backendKeys[field] || field, value])) }
}

export const billingContract = {
  backend: 'supabase_edge_function', function: 'billing', stripe_mode: 'test',
  required_migrations: ['20261020174341_stripe_billing_foundation.sql', '20261020213005_stripe_billing_failure_reconciliation.sql', '20261020221050_billing_immediate_promotions.sql'],
  authentication: 'dedicated_supabase_superadmin', quote_validity_seconds: 300,
  onboarding_prompt: 'tickit_pos_company_onboarding', writes_require_confirm: true,
  initial_activation: 'Checkout y pago del cliente; verificar mediante reconcile/get. Crear Checkout no activa derechos.',
  feature_authority: 'Contrato confirmado y proyección de POS; no escribir asignaciones ni límites para saltar Stripe.',
  recovery: 'Consultar get/reconcile; reutilizar operation_id con retry_operation. Nunca reintentar automáticamente ni crear otra operación ante incertidumbre.',
}
