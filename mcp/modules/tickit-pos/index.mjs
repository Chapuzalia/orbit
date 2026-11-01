import { z } from 'zod'
import { TickitPosService, readTickitConfig, tickitError } from './supabase-service.mjs'
import { uuid, tenantInput, venueInput, confirmInput, entities, entityDataSchema, listSchema, userCreateSchema, userUpdateSchema, accessGrantSchema, tenantConfigureSchema, tenantConfigContract } from './admin-schema.mjs'
import { catalogCommands } from './catalog.mjs'
import { billingCommands } from './billing-schema.mjs'
import { configureVenueOperations, venueOperationsSchema, venueOperationsContract } from './venue-operations.mjs'
import { provisionDeviceCredentials, deviceCredentialsSchema, deviceAccessContract } from './devices.mjs'

export function createTickitPosModule(service) {
  const metadata = () => ({ backend: 'supabase', environment: service.config.environment, access: 'platform_superadmin', scope: 'platform', read_only: service.config.readOnly })
  return {
    id: 'tickit_pos', version: '3.2.0', description: 'Superadmin de Tickit POS staging: empresas, propietarios, dispositivos con credenciales, accesos, catálogo y facturación Stripe sandbox mediante el servicio de POS.',
    config: service.config, formatError: tickitError, metadata,
    health: async () => { await service.capabilities(); return { connected: true, ...metadata() } },
    register({ server, register, catalog }) {
      register('tickit_pos_capabilities', 'Comprueba Data API y Auth Admin. Descubre las herramientas con permisos globales de superadmin.', z.object({}).strict(), () => service.capabilities(), { readOnly: true })
      register('tickit_pos_catalog_get', 'Consulta el catálogo agregado de cualquier local con get_catalog. Precios en céntimos enteros.', z.object({ venue_id: uuid, mode: z.enum(['admin', 'pos']).default('admin') }).strict(), ({ venue_id, mode }) => service.catalog(venue_id, mode), { readOnly: true })
      register('tickit_pos_venue_operations_configure', 'Enciende/apaga mesas, producción e inventario de un local. Comprueba antes los derechos contratados/asignados; no cambia el plan ni concede addons. Producción activa mesas; apagar mesas apaga producción. Desactivar requiere cerrar cajas/comandas. confirm=true.', venueOperationsSchema, (args) => configureVenueOperations(service, args), { destructive: true, idempotent: true })
      register('tickit_pos_devices_credentials_create', 'Completa las credenciales de un dispositivo existente por device_id. Crea cuenta Auth, perfil cajero y vínculo al terminal; conserva accesos existentes sin restablecer contraseñas. No activa empresas, locales ni dispositivos desactivados. Requiere confirm=true; password opcional usa el valor predeterminado.', deviceCredentialsSchema, (args) => provisionDeviceCredentials(service, args))
      for (const [command, def] of Object.entries(billingCommands)) {
        register(`tickit_pos_billing_${command}`, `${def.description} Usa la Edge Function billing de POS y una cuenta Superadmin dedicada; únicamente Stripe test.`,
          def.schema, (args) => service.billing.execute(command, args), { readOnly: def.readOnly, destructive: ['confirm', 'retry_operation', 'quote_cancel', 'catalog_save', 'settings'].includes(command) })
      }
      for (const [entity, def] of Object.entries(entities)) {
        for (const operation of def.operations) {
          const schema = operation === 'list' ? listSchema(entity) : z.object({ ...(def.scope !== 'platform' ? tenantInput : {}), ...(def.scope === 'venue' ? venueInput : {}),
            ...(operation !== 'create' ? { id: uuid } : {}),
            ...(!['get', 'list'].includes(operation) ? confirmInput : {}),
            ...(['create', 'update'].includes(operation) ? { data: entityDataSchema(entity, operation) } : {}),
          }).strict()
          register(`tickit_pos_${entity}_${operation}`, `${operation} de ${entity} con permisos de plataforma. Las listas sin filtros abarcan todas las empresas. Para crear indica tenant_id o venue_id según el destino; get/update/delete pueden deducirlo del id.${entity === 'tenants' && operation === 'delete' ? ' Elimina la empresa y sus datos por cascada; conserva cuentas Auth.' : ''}${entity === 'venues' && operation === 'create' ? ' Crea catálogo custom vacío; respeta límites del plan.' : ''}${entity === 'devices' && operation === 'create' ? ' Crea automáticamente su cuenta cajero y vinculación; devuelve access con email y user_id. No crees un segundo cashier. Si falla, conserva device_id y usa devices_credentials_create tras revisar el estado.' : ''}`,
            schema, (args) => service.execute(entity, operation, args), { readOnly: ['list', 'get'].includes(operation), destructive: ['update', 'delete'].includes(operation), idempotent: operation === 'update' })
        }
      }
      register('tickit_pos_platform_tenant_configure', 'Actualiza nombre, slug, límites y conjunto completo de complementos mediante update_platform_tenant_config. feature_keys reemplaza los complementos anteriores; las funciones básicas ya están incluidas y no se envían. Usa claves actuales: discounts no es descuento manual y se rechaza. Para restaurante y analítica avanzada usa ["restaurant","analytics_advanced"], con los límites acordados. No contrata un plan de facturación. Conserva validaciones de uso y facturación; requiere la migración de Tickit Assist.', tenantConfigureSchema, (args) => service.configureTenant(args), { destructive: true })
      for (const [command, def] of Object.entries(catalogCommands)) {
        register(`tickit_pos_${command}`, `Ejecuta ${command} en el local indicado mediante su RPC transaccional. priceCents/supplementCents son céntimos enteros. Requiere confirm=true.`,
          z.object({ venue_id: uuid, data: def.schema, ...confirmInput }).strict(), (args) => service.catalogCommand(command, args), { destructive: !command.endsWith('_create') })
      }
      register('tickit_pos_users_list', 'Lista todas las cuentas Auth, incluidos superadmins y cuentas sin empresa. tenant_id es un filtro opcional.', z.object({ ...tenantInput, page: z.number().int().min(1).max(100000).default(1), per_page: z.number().int().min(1).max(100).default(50) }).strict(), (args) => service.users.list(args), { readOnly: true })
      register('tickit_pos_users_get', 'Consulta una cuenta Auth, su perfil superadmin y todas sus membresías y accesos de la plataforma.', z.object({ user_id: uuid }).strict(), ({ user_id }) => service.users.get(user_id), { readOnly: true })
      register('tickit_pos_users_create', 'Crea una cuenta user o superadmin global sin empresa, o owner/manager/cashier con tenant_id. Todos los roles pueden omitir password para usar la contraseña predeterminada. Manager requiere venue_ids y cashier device_id. Auth permanece bloqueado durante el alta. No envía emails.', userCreateSchema, (args) => service.users.create(args))
      register('tickit_pos_users_update', 'Actualiza cualquier cuenta, compartida o superadmin: email, password, full_name, is_superadmin, email_confirm o ban_duration. is_superadmin modifica el perfil real de Tickit.', userUpdateSchema, (args) => service.users.update(args), { destructive: true })
      register('tickit_pos_users_delete', 'Borrado GLOBAL de Auth, incluidos owners y superadmins. Desactiva superadmin y accesos en TODAS las empresas. Requiere cerrar cajas/comandas abiertas.', z.object({ user_id: uuid, ...confirmInput }).strict(), ({ user_id, confirm }) => service.users.delete(user_id, confirm), { destructive: true })
      register('tickit_pos_access_grant', 'Concede, reactiva o cambia rol owner/manager/cashier en el tenant_id indicado. Admite cuentas compartidas y superadmins. Reemplaza locales del manager o dispositivo del cashier. Requiere cerrar trabajo abierto.', accessGrantSchema, (args) => service.users.grant(args), { destructive: true })
      register('tickit_pos_access_revoke', 'Desactiva acceso a una empresa, incluidos owners. Conserva otras membresías, Auth y perfil superadmin; usa users_update para retirar privilegios globales.', z.object({ user_id: uuid, tenant_id: uuid, ...confirmInput }).strict(), ({ user_id, tenant_id, confirm }) => service.users.revoke(user_id, tenant_id, confirm), { destructive: true })
      server.registerPrompt('tickit_pos_company_onboarding', { description: 'Guía de alta de empresa, owner, locales, dispositivos, accesos y contratación Stripe sandbox.' }, async () => ({ messages: [{ role: 'user', content: { type: 'text', text: [
        'Completa el alta solicitada usando las herramientas disponibles. Consulta tickit_pos_capabilities y billing_catalog para verificar entorno, configuración, tarifas publicadas, funciones y capacidad.',
        'Busca por slug/email e inspecciona los registros existentes antes de crear; guarda los IDs de cada paso completado.',
        'Crea tenants, su owner con users_create (role=owner, tenant_id), venues y dispositivos con devices_create. El alta del dispositivo incluye automáticamente cuenta cashier, perfil y vinculación: comprueba access.account y conserva email y user_id. No crees un segundo cashier. Para dispositivos ya existentes sin credenciales, usa devices_credentials_create con device_id y confirm=true; conserva accesos existentes.',
        'Respeta límites y, si hace falta capacidad para aprovisionar, acuerda primero el contrato y crea después los recursos adicionales.',
        'Configura billing_settings, selecciona planVersionId y addons por catálogo y solicita billing_quote con motivo y confirm=true. Usa venueIds/deviceIds de esa empresa; no inventes precios ni funciones fuera del catálogo.',
        'Presenta importe inicial, cuota recurrente, impuestos de la vista previa, momento de aplicación y promociones. Confirma el presupuesto acordado con billing_confirm y el mismo operation_id dentro de su vigencia.',
        'Entrega el enlace Checkout si lo devuelve: el cliente completa allí el pago. Ejecuta billing_reconcile y billing_get para verificar estado, contrato y derechos antes de afirmar que está activado.',
        'Después usa venue_operations_configure para encender mesas, producción o inventario contratados. No concede derechos ni reasigna addons. Los KDS se crean después de habilitar producción y disponer de un destino activo con kds_enabled. Tickit Assist se contrata por Billing, pero su interruptor local exige actualmente la sesión de un owner/manager en CRM.',
        'No uses platform_tenant_configure para saltar el contrato. Cada paso persiste por separado: ante fallo informa IDs y estado parcial, no borres recursos ni crees otro presupuesto tras una respuesta económica incierta. Recupera mediante get/reconcile/retry_operation con el ID original.',
        'No crees empresas reales ni cobres sin un encargo concreto del usuario; este flujo solo admite staging/Stripe test.',
      ].join(' ') } }] }))
      server.registerResource('tickit-pos-module', 'tickit-pos://capabilities', { description: 'Catálogo de superadmin Tickit POS mediante Supabase.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ ...metadata(),
        tools: catalog, tenant_configuration: tenantConfigContract, billing: service.billing.capabilities(), venue_operations: venueOperationsContract, device_access: deviceAccessContract, limits: { page_size: 100, response_bytes: 4194304 },
        limitations: ['La clave de servicio y el token MCP conceden administración de toda la plataforma.', 'Auth y PostgREST no forman una transacción distribuida; se informa cualquier compensación incompleta.', 'Las tablas económicas se consultan; sus escrituras requieren contratos específicos.', 'Se ejecutan exclusivamente herramientas y RPC declarados.', 'El operador debe configurar la URL y clave del staging correcto.'],
      }) }] }))
    },
  }
}
export function loadModule(env) { return createTickitPosModule(new TickitPosService(readTickitConfig(env))) }
