import { z } from 'zod'
import { TickitPosService, readTickitConfig, tickitError } from './supabase-service.mjs'
import { uuid, tenantInput, venueInput, confirmInput, entities, entityDataSchema, listSchema, userCreateSchema, userUpdateSchema, accessGrantSchema, tenantConfigureSchema } from './admin-schema.mjs'
import { catalogCommands } from './catalog.mjs'

export function createTickitPosModule(service) {
  const metadata = () => ({ backend: 'supabase', environment: service.config.environment, access: 'platform_superadmin', scope: 'platform', read_only: service.config.readOnly })
  return {
    id: 'tickit_pos', version: '3.0.0', description: 'Superadmin de toda la plataforma Tickit POS staging mediante Supabase: empresas, usuarios globales, accesos, catálogo y configuración.',
    config: service.config, formatError: tickitError, metadata,
    health: async () => { await service.capabilities(); return { connected: true, ...metadata() } },
    register({ server, register, catalog }) {
      register('tickit_pos_capabilities', 'Comprueba Data API y Auth Admin. Descubre las herramientas con permisos globales de superadmin.', z.object({}).strict(), () => service.capabilities(), { readOnly: true })
      register('tickit_pos_catalog_get', 'Consulta el catálogo agregado de cualquier local con get_catalog. Precios en céntimos enteros.', z.object({ venue_id: uuid, mode: z.enum(['admin', 'pos']).default('admin') }).strict(), ({ venue_id, mode }) => service.catalog(venue_id, mode), { readOnly: true })
      for (const [entity, def] of Object.entries(entities)) {
        for (const operation of def.operations) {
          const schema = operation === 'list' ? listSchema(entity) : z.object({ ...(def.scope !== 'platform' ? tenantInput : {}), ...(def.scope === 'venue' ? venueInput : {}),
            ...(operation !== 'create' ? { id: uuid } : {}),
            ...(!['get', 'list'].includes(operation) ? confirmInput : {}),
            ...(['create', 'update'].includes(operation) ? { data: entityDataSchema(entity, operation) } : {}),
          }).strict()
          register(`tickit_pos_${entity}_${operation}`, `${operation} de ${entity} con permisos de plataforma. Las listas sin filtros abarcan todas las empresas. Para crear indica tenant_id o venue_id según el destino; get/update/delete pueden deducirlo del id.${entity === 'tenants' && operation === 'delete' ? ' Elimina la empresa y sus datos por cascada; conserva cuentas Auth.' : ''}${entity === 'venues' && operation === 'create' ? ' Crea catálogo custom vacío; respeta límites del plan.' : ''}`,
            schema, (args) => service.execute(entity, operation, args), { readOnly: ['list', 'get'].includes(operation), destructive: ['update', 'delete'].includes(operation), idempotent: operation === 'update' })
        }
      }
      register('tickit_pos_platform_tenant_configure', 'Actualiza nombre, slug, límites y lista completa de funciones de cualquier empresa con el RPC update_platform_tenant_config. Conserva validaciones de uso, plan y facturación. feature_keys reemplaza la configuración anterior.', tenantConfigureSchema, (args) => service.configureTenant(args), { destructive: true })
      for (const [command, def] of Object.entries(catalogCommands)) {
        register(`tickit_pos_${command}`, `Ejecuta ${command} en el local indicado mediante su RPC transaccional. priceCents/supplementCents son céntimos enteros. Requiere confirm=true.`,
          z.object({ venue_id: uuid, data: def.schema, ...confirmInput }).strict(), (args) => service.catalogCommand(command, args), { destructive: !command.endsWith('_create') })
      }
      register('tickit_pos_users_list', 'Lista todas las cuentas Auth, incluidos superadmins y cuentas sin empresa. tenant_id es un filtro opcional.', z.object({ ...tenantInput, page: z.number().int().min(1).max(100000).default(1), per_page: z.number().int().min(1).max(100).default(50) }).strict(), (args) => service.users.list(args), { readOnly: true })
      register('tickit_pos_users_get', 'Consulta una cuenta Auth, su perfil superadmin y todas sus membresías y accesos de la plataforma.', z.object({ user_id: uuid }).strict(), ({ user_id }) => service.users.get(user_id), { readOnly: true })
      register('tickit_pos_users_create', 'Crea una cuenta user o superadmin global sin empresa, o owner/manager/cashier con tenant_id. Manager requiere venue_ids y cashier device_id. Auth permanece bloqueado durante el alta. No envía emails.', userCreateSchema, (args) => service.users.create(args))
      register('tickit_pos_users_update', 'Actualiza cualquier cuenta, compartida o superadmin: email, password, full_name, is_superadmin, email_confirm o ban_duration. is_superadmin modifica el perfil real de Tickit.', userUpdateSchema, (args) => service.users.update(args), { destructive: true })
      register('tickit_pos_users_delete', 'Borrado GLOBAL de Auth, incluidos owners y superadmins. Desactiva superadmin y accesos en TODAS las empresas. Requiere cerrar cajas/comandas abiertas.', z.object({ user_id: uuid, ...confirmInput }).strict(), ({ user_id, confirm }) => service.users.delete(user_id, confirm), { destructive: true })
      register('tickit_pos_access_grant', 'Concede, reactiva o cambia rol owner/manager/cashier en el tenant_id indicado. Admite cuentas compartidas y superadmins. Reemplaza locales del manager o dispositivo del cashier. Requiere cerrar trabajo abierto.', accessGrantSchema, (args) => service.users.grant(args), { destructive: true })
      register('tickit_pos_access_revoke', 'Desactiva acceso a una empresa, incluidos owners. Conserva otras membresías, Auth y perfil superadmin; usa users_update para retirar privilegios globales.', z.object({ user_id: uuid, tenant_id: uuid, ...confirmInput }).strict(), ({ user_id, tenant_id, confirm }) => service.users.revoke(user_id, tenant_id, confirm), { destructive: true })
      server.registerResource('tickit-pos-module', 'tickit-pos://capabilities', { description: 'Catálogo de superadmin Tickit POS mediante Supabase.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ ...metadata(),
        tools: catalog, limits: { page_size: 100, response_bytes: 4194304 },
        limitations: ['La clave de servicio y el token MCP conceden administración de toda la plataforma.', 'Auth y PostgREST no forman una transacción distribuida; se informa cualquier compensación incompleta.', 'Las tablas económicas se consultan; sus escrituras requieren contratos específicos.', 'Se ejecutan exclusivamente herramientas y RPC declarados.', 'El operador debe configurar la URL y clave del staging correcto.'],
      }) }] }))
    },
  }
}
export function loadModule(env) { return createTickitPosModule(new TickitPosService(readTickitConfig(env))) }
