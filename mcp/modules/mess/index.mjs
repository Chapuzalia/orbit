import { z } from 'zod'
import { MessService, readMessConfig, messError } from './service.mjs'
import { fields, listInput, reservationGet, reservationCreate, reservationUpdate, reservationDelete, availabilityInput, calendarInput } from './schema.mjs'

export function createMessModule(service) {
  const metadata = () => ({ backend: 'pocketbase', scope: 'venue_reservations', auth_collection: service.config.authCollection, timezone: 'Europe/Madrid', read_only: service.config.readOnly })
  return {
    id: 'mess', version: '1.0.0', description: 'Calendario operativo de reservas de MESS: disponibilidad, contactos, camarero, DJ y señal pagada.',
    config: service.config, formatError: messError, metadata, health: () => service.identity(),
    register({ server, register, catalog }) {
      const capabilities = () => ({ ...metadata(), tools: catalog, fields: Object.keys(fields),
        limits: { page_size: 100, calendar_records: 10000, response_bytes: 4194304 },
        limitations: ['Fechas y horas locales de Europe/Madrid, sin conversión a UTC.', 'Disponibilidad por día completo mediante el endpoint existente de MESS; no bloquea ni evita reservas simultáneas.', 'waiter_id es texto libre, no una relación users.', 'No hay duración, aforo ni estado cancelado: cancelar implica eliminar la reserva.', 'No se envían mensajes ni se modifican socios, campañas o agenda personal.'],
      })
      register('mess_capabilities', 'Descubre herramientas, campos y límites del calendario de reservas de MESS.', z.object({}).strict(), async () => capabilities(), { readOnly: true })
      register('mess_whoami', 'Comprueba la cuenta de MESS y acceso al calendario sin mostrar credenciales.', z.object({}).strict(), () => service.identity(), { readOnly: true })
      register('mess_reservations_list', 'Lista reservas ordenadas por fecha y hora. from/to son inclusivos YYYY-MM-DD. Filtra texto, camarero, DJ o señal pagada; paginación de hasta 100.', listInput, (input) => service.list(input), { readOnly: true })
      register('mess_reservations_get', 'Consulta todos los datos operativos de una reserva por su ID de PocketBase.', reservationGet, (input) => service.get(input), { readOnly: true })
      register('mess_reservations_create', 'Crea una reserva en el calendario operativo. Fecha YYYY-MM-DD y hora HH:mm[:ss] en Europe/Madrid; waiter_id es texto. Requiere confirm=true.', reservationCreate, (input) => service.create(input))
      register('mess_reservations_update', 'Edita los campos indicados de una reserva: reprogramar fecha/hora, contacto, camarero, DJ o señal. Requiere confirm=true.', reservationUpdate, (input) => service.update(input), { destructive: true, idempotent: true })
      register('mess_reservations_delete', 'Elimina definitivamente una reserva; es la forma de cancelación del esquema actual de MESS. Requiere confirm=true.', reservationDelete, (input) => service.delete(input), { destructive: true })
      register('mess_calendar_get', 'Calendario mensual YYYY-MM con reservas por día, días ocupados, DJ y señales pendientes. No interpreta días vacíos como disponibilidad garantizada.', calendarInput, (input) => service.calendar(input), { readOnly: true })
      register('mess_availability_check', 'Consulta disponibilidad de un día YYYY-MM-DD mediante la regla existente de MESS: fechas pasadas y días con alguna reserva no disponibles. No reserva ni bloquea el día.', availabilityInput, (input) => service.availability(input), { readOnly: true })
      server.registerResource('mess-capabilities', 'mess://capabilities', { description: 'Herramientas y contrato del calendario de reservas de MESS.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(capabilities()) }] }))
    },
  }
}
export function loadModule(env) { return createMessModule(new MessService(readMessConfig(env))) }
