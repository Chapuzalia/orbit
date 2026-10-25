import { z } from 'zod'

export const id = z.string().regex(/^[a-z0-9]{15}$/, 'ID de PocketBase inválido.')
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}, 'Fecha inexistente; usa YYYY-MM-DD.')
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
export const confirm = { confirm: z.literal(true) }
const requiredText = (max) => z.string().trim().min(1).max(max)

// Exact business fields from MESS venue_reservations. No arbitrary collection/field access.
export const fields = {
  reservation_date: date,
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  concept: requiredText(1000),
  contact_person: requiredText(200),
  contact_phone: requiredText(30),
  waiter_id: requiredText(200).describe('Nombre o identificador de camarero; MESS lo guarda como texto, no como relación users.'),
  needs_dj: z.boolean(),
  deposit_paid: z.boolean(),
}
export const createData = z.object({ ...fields, needs_dj: fields.needs_dj.default(false), deposit_paid: fields.deposit_paid.default(false) }).strict()
export const updateData = z.object(fields).partial().strict().refine((input) => Object.keys(input).length > 0, 'Indica algún campo para editar.')
export const reservationCreate = z.object({ data: createData, ...confirm }).strict()
export const reservationUpdate = z.object({ id, data: updateData, ...confirm }).strict()
export const reservationDelete = z.object({ id, ...confirm }).strict()
export const reservationGet = z.object({ id }).strict()
export const availabilityInput = z.object({ date }).strict()
export const calendarInput = z.object({ month }).strict()
export const listInput = z.object({
  from: date.optional(), to: date.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  waiter_id: requiredText(200).optional(), needs_dj: z.boolean().optional(), deposit_paid: z.boolean().optional(),
  page: z.number().int().min(1).max(100000).default(1), per_page: z.number().int().min(1).max(100).default(50),
}).strict().refine((input) => !input.from || !input.to || input.from <= input.to, 'from debe ser anterior o igual a to.')

export const reservationColumns = ['id', ...Object.keys(fields), 'created', 'updated']
