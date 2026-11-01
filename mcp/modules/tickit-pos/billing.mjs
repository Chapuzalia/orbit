import { createClient } from '@supabase/supabase-js'
import { billingBody, billingCommands, billingContract } from './billing-schema.mjs'
import { TickitError } from './supabase-service.mjs'

export class TickitBilling {
  constructor(service) { this.s = service }
  capabilities() {
    return { ...billingContract, configured: Boolean(this.s.config.billingEmail && this.s.config.billingPassword),
      commands: Object.entries(billingCommands).filter(([, def]) => !this.s.config.readOnly || def.readOnly).map(([name]) => name) }
  }
  async execute(commandName, input) {
    const def = billingCommands[commandName]
    if (!def) throw new TickitError('OPERATION_UNAVAILABLE', 'Operación de facturación no disponible.')
    const body = billingBody(commandName, input)
    if (!def.readOnly) this.s.assertWrite(input.confirm)
    const config = this.s.config
    if (!config.billingEmail || !config.billingPassword) throw new TickitError('BILLING_NOT_CONFIGURED', 'Configura TICKIT_POS_BILLING_EMAIL y TICKIT_POS_BILLING_PASSWORD con una cuenta Superadmin dedicada del mismo staging.')
    // A fresh, isolated Auth client per request: never replace the service-role
    // session used for platform CRUD, or share mutable user sessions concurrently.
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: this.s.fetchImpl },
    })
    let auth
    try { auth = await client.auth.signInWithPassword({ email: config.billingEmail, password: config.billingPassword }) }
    catch { throw new TickitError('BILLING_AUTH_FAILED', 'No se pudo autenticar la cuenta de facturación.') }
    if (auth.error || !auth.data.user || !auth.data.session) throw new TickitError('BILLING_AUTH_FAILED', 'No se pudo autenticar la cuenta de facturación.')
    const { data: profile } = await this.s.result(this.s.db.from('profiles').select('is_superadmin').eq('id', auth.data.user.id).maybeSingle())
    if (profile?.is_superadmin !== true) throw new TickitError('BILLING_FORBIDDEN', 'La cuenta de facturación debe ser Superadmin en Tickit.')
    if (body.tenantId) await this.s.tenant(body.tenantId)
    const recovery = { ...(body.tenantId ? { tenant_id: body.tenantId } : {}), ...(body.operationId ? { operation_id: body.operationId } : {}),
      recovery: 'Consulta billing_get y billing_reconcile antes de continuar. Recupera con el mismo operation_id; no crees otra operación ni repitas cargos automáticamente.' }
    let response
    try { response = await client.functions.invoke('billing', { body }) }
    catch { throw new TickitError('BILLING_UNAVAILABLE', 'No se recibió respuesta válida de facturación.', { ...recovery, outcome_unknown: !def.readOnly }) }
    if (response.error || !response.data || typeof response.data !== 'object' || Array.isArray(response.data) || response.data.error) {
      const status = response.error?.context instanceof Response ? response.error.context.status : null
      // Do not forward arbitrary Edge/Stripe error bodies, messages or URLs.
      throw new TickitError('BILLING_REQUEST_FAILED', 'Facturación rechazó la solicitud o no devolvió un resultado válido. Revisa configuración, presupuesto, permisos y supervisión de Tickit.',
        { ...recovery, ...(status ? { status } : {}), outcome_unknown: !def.readOnly && ![400, 401, 403, 405, 413].includes(status) })
    }
    return this.s.sanitize(response.data, [auth.data.session.access_token, auth.data.session.refresh_token])
  }
}
