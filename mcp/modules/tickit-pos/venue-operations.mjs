import { z } from 'zod'
import { uuid, confirmInput } from './admin-schema.mjs'
import { TickitError } from './supabase-service.mjs'

const flags = ['tables_enabled', 'production_enabled', 'inventory_enabled']
export const venueOperationsSchema = z.object({ venue_id: uuid, data: z.object(Object.fromEntries(flags.map(flag => [flag, z.boolean().optional()])))
  .strict().refine(data => Object.values(data).some(value => value !== undefined), 'Indica al menos un interruptor.'), ...confirmInput }).strict()
export const venueOperationsContract = {
  tool: 'tickit_pos_venue_operations_configure', flags,
  authority: 'Solo interruptores operativos; no concede funciones ni cambia contratos o asignaciones comerciales.',
  rules: 'Activar producción activa mesas; apagar mesas apaga producción. Las desactivaciones bloquean con cajas/comandas abiertas.',
}

export async function configureVenueOperations(service, input) {
  input = venueOperationsSchema.parse(input)
  service.assertWrite(input.confirm)
  const venue = await service.venue(input.venue_id)
  if (!venue.is_active) throw new TickitError('VENUE_INACTIVE', 'Activa el local antes de configurar sus operaciones.')
  const scoped = service.forTenant(venue.tenant_id)
  const { data: current } = await service.result(service.db.from('venues').select(`id,tenant_id,${flags.join(',')}`).eq('tenant_id', venue.tenant_id).eq('id', venue.id).single())
  const values = Object.fromEntries(Object.entries(input.data).filter(([, value]) => value !== undefined))
  if (values.production_enabled === true && values.tables_enabled === false) throw new TickitError('VENUE_OPERATIONS_CONFLICT', 'Producción necesita mesas activadas.')
  if (values.production_enabled === true) values.tables_enabled = true
  if (values.tables_enabled === false) values.production_enabled = false
  const required = new Set()
  if (values.tables_enabled === true) required.add('restaurant')
  if (values.production_enabled === true) required.add('production')
  if (values.inventory_enabled === true) required.add('inventory')
  for (const addon of required) {
    const { data: entitled } = await service.result(service.db.rpc('venue_addon_enabled', { p_tenant_id: venue.tenant_id, p_venue_id: venue.id, p_addon_key: addon }))
    if (entitled !== true) throw new TickitError('VENUE_ADDON_NOT_CONTRACTED', 'La función no está contratada y asignada a este local. Revisa el contrato y concilia antes de activar.', { venue_id: venue.id, addon_key: addon, write_attempted: false })
  }
  if (Object.entries(values).some(([flag, value]) => value === false && current[flag] !== false)) {
    await scoped.guardOpenWork('venues', { id: venue.id }, { is_active: false })
    const { data: carried } = await service.result(service.db.from('orders').select('id').eq('tenant_id', venue.tenant_id).eq('venue_id', venue.id).eq('status', 'carried_forward').limit(1))
    if (carried?.length) throw new TickitError('OPEN_WORK', 'Cierra las comandas arrastradas antes de desactivar operaciones del local.')
  }
  // These flags cannot grant entitlement. Runtime capability checks still require
  // the tenant contract and venue assignment, including if Billing changes concurrently.
  try {
    const { data } = await service.result(service.db.from('venues').update(values).eq('tenant_id', venue.tenant_id).eq('id', venue.id).select(`id,tenant_id,${flags.join(',')}`).single(), true)
    return service.sanitize(data)
  } catch (error) {
    if (error instanceof TickitError && error.details?.outcome_unknown) error.details.venue_id = venue.id
    throw error
  }
}
