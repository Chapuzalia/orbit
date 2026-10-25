# MESS: calendario de reservas mediante MCP

El módulo `mess` conecta directamente al PocketBase de MESS. Usa la colección real `venue_reservations`, compartida con el calendario operativo de la web. Las altas y cambios aparecen al recargar ese calendario. No necesita la API Node de WhatsApp ni Supabase.

## Configuración de Coolify

Conserva el Dockerfile, dominio y token HTTP del MCP existente. Añade `mess` a los módulos y estas variables **Runtime**, sin exponerlas durante el build:

```dotenv
ALTEIL_MODULES=orbit,tickit_pos,mess

MESS_POCKETBASE_URL=https://pb.messigualada.com
MESS_AUTH_COLLECTION=users
MESS_USER_EMAIL=<email_de_personal_de_MESS>
MESS_USER_PASSWORD=<password>
MESS_READ_ONLY=false
```

Usa la URL de tu instancia si es diferente. Debe ser el origen HTTPS de PocketBase, sin `/_/` ni `/api`. No hay URL remota por defecto ni se reutilizan credenciales de Orbit. Si solo quieres MESS, `ALTEIL_MODULES=mess` no requiere las variables de otros productos.

En el esquema actual, tanto `users.role=admin` como `users.role=user` pueden gestionar todas las reservas del local. El MCP respeta esas reglas de PocketBase.

También puedes usar un superusuario de servidor:

```dotenv
MESS_AUTH_COLLECTION=_superusers
MESS_USER_EMAIL=<email_superusuario>
MESS_USER_PASSWORD=<password_superusuario>
```

Como alternativa a email/password, configura `MESS_USER_TOKEN` con un token de la colección elegida; tiene prioridad sobre email/password. En `users` se verifica mediante `authRefresh`. Para tokens API/impersonación de `_superusers`, que no son renovables, se verifica acceso privado al esquema de reservas sin intentar refrescarlos.

Todas las credenciales permanecen en el servidor. Grokbot mantiene la misma URL `/mcp` y el mismo Bearer token. Tras redesplegar, actualiza el catálogo de herramientas del agente.

`MESS_READ_ONLY=true` oculta y bloquea las escrituras del módulo. `ALTEIL_MCP_READ_ONLY=true` lo hace para todos los productos.

## Herramientas

| Herramienta | Función |
| --- | --- |
| `mess_capabilities` | Campos, herramientas, límites y reglas del módulo |
| `mess_whoami` | Verificar autenticación y acceso a reservas |
| `mess_reservations_list` | Listar y buscar reservas con paginación |
| `mess_reservations_get` | Consultar una reserva por ID |
| `mess_reservations_create` | Crear una reserva |
| `mess_reservations_update` | Editar o reprogramar una reserva |
| `mess_reservations_delete` | Eliminar una reserva |
| `mess_calendar_get` | Calendario mensual, ocupación, DJ y señales pendientes |
| `mess_availability_check` | Disponibilidad de un día mediante el endpoint existente de MESS |

Puedes verificar la conexión con `alteil_module_health` y `{"module":"mess"}`. El recurso `mess://capabilities` permite descubrir el contrato sin conectar al backend.

## Campos y ejemplos

Los campos coinciden con PocketBase y usan `snake_case`. Las fechas `YYYY-MM-DD` y horas `HH:mm` o `HH:mm:ss` representan hora local de **Europe/Madrid**. No se convierten a UTC: una reserva de las 01:30 conserva exactamente el día indicado.

Crear con `mess_reservations_create`:

```json
{
  "data": {
    "reservation_date": "2026-11-14",
    "start_time": "20:30",
    "concept": "Cumpleaños privado",
    "contact_person": "Ana",
    "contact_phone": "+34 612345678",
    "waiter_id": "Camarero A",
    "needs_dj": true,
    "deposit_paid": false
  },
  "confirm": true
}
```

`needs_dj` y `deposit_paid` son opcionales al crear y valen false por defecto. Los otros seis campos son obligatorios. `waiter_id` es un nombre o identificador de texto libre en MESS; no es una relación a cuentas `users`.

Consultar noviembre con `mess_calendar_get`:

```json
{ "month": "2026-11" }
```

Devuelve todos los días del mes, reservas por día, número de días ocupados, reservas con DJ y señales pendientes. Usa paginación interna y falla expresamente si se superan 10000 reservas; no entrega un resumen incompleto. El resultado no es una instantánea transaccional: puede cambiar si se editan reservas mientras se consultan sus páginas.

Buscar señales pendientes con `mess_reservations_list`:

```json
{
  "from": "2026-11-01",
  "to": "2026-11-30",
  "deposit_paid": false,
  "page": 1,
  "per_page": 50
}
```

`from` y `to` son inclusivos. Puedes omitirlos para consultar todo el historial. Otros filtros: `search` (concepto, contacto, teléfono o camarero), `waiter_id`, `needs_dj` y `deposit_paid`. `per_page` admite 1–100. Las listas devuelven `items`, `has_more`, `total_items` y `total_pages`, ordenadas por fecha, hora e ID.

Reprogramar y registrar la señal con `mess_reservations_update`:

```json
{
  "id": "<id_pocketbase_de_15_caracteres>",
  "data": { "reservation_date": "2026-11-15", "start_time": "21:00", "deposit_paid": true },
  "confirm": true
}
```

Solo cambia los campos incluidos. No se aceptan IDs, timestamps ni otros campos de sistema dentro de `data`. No hay control de versiones atómico; una edición concurrente del mismo campo puede sobrescribir la anterior.

Eliminar/cancelar con `mess_reservations_delete`:

```json
{ "id": "<id_pocketbase>", "confirm": true }
```

## Reglas del calendario actual

- La colección no tiene estado `cancelled`; cancelar significa eliminar definitivamente el registro.
- No hay duración, hora final, aforo, sala ni relación de camareros en este esquema. El módulo conserva ese modelo.
- El calendario permite varias reservas en el mismo día. No se introduce una restricción adicional desde el MCP.
- `mess_availability_check` recibe `{"date":"2026-11-14"}` y consulta `/api/mess/venue-availability`. La regla existente considera no disponibles las fechas pasadas o con alguna reserva, usando el día de negocio de Europe/Madrid. Es una comprobación informativa, sin bloqueo ni garantía ante cambios simultáneos.
- El módulo no modifica socios, campañas, puntos, cuentas, suscripciones push ni agenda personal. Tampoco envía WhatsApp, emails o recordatorios nuevos.

Cada escritura requiere `confirm:true`. Ante pérdida de conexión o error de servidor devuelve `outcome_unknown:true`, operación e ID de la reserva solicitada. No se reintenta automáticamente: consulta ese ID antes de repetir para evitar duplicados. Los contactos de las reservas se entregan al agente que tenga el token MCP; las credenciales de autenticación no se incluyen en sus resultados.

## Verificación

`pnpm test:mcp` incluye pruebas MCP sobre PocketBase local aislado, con una copia del esquema y hooks de MESS en `tests/fixtures/mess`. Comprueba CRUD, reprogramación, paginación, años bisiestos, disponibilidad real, filtros, credenciales de ambas colecciones, modo lectura y respuesta perdida después de una escritura confirmada en la base.

Las pruebas no utilizan datos ni credenciales reales y no aplican migraciones al servidor MESS. La integración usa el SDK oficial existente de PocketBase, sin añadir dependencias.
