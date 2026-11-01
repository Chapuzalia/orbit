# Tickit POS: alta de empresas y facturación Stripe

Revisión dirigida del código de `Alteil_Projects/POS` el 1 de noviembre de 2026. El módulo Tickit pasa a **3.1.0**. Los cambios se preparan en Orbit; no requieren editar POS ni introducir migraciones.

## Qué había quedado desactualizado

El MCP ya permite crear empresas, locales, usuarios owner/manager/cashier, dispositivos y asignaciones. Sin embargo, `platform_tenant_configure` modifica derechos operativos manuales: no contrata ni actualiza Stripe.

También faltaba exponer los interruptores operativos de los locales: tener contratado restaurante, producción o inventario no enciende sus flags locales. La herramienta nueva `tickit_pos_venue_operations_configure` cubre ese paso comprobando el derecho por empresa/local con `venue_addon_enabled`.

POS ahora tiene un catálogo comercial versionado, contratos y excepciones/promociones, presupuestos persistidos, una suscripción consolidada por empresa, Checkout/Portal y conciliación. `billing_accounts` mantiene el contrato y la proyección de derechos; las protecciones SQL impiden modificar funciones/límites por el camino manual cuando existe contrato Stripe. La suscripción afecta a funciones, capacidad de locales/dispositivos y asignaciones por local.

La Edge Function `supabase/functions/billing/index.ts` autentica un **usuario Auth**, consulta `profiles.is_superadmin` y delega en `_shared/billing/service.ts`. Enviar únicamente el JWT `service_role` del MCP no satisface esa autenticación. Por eso la ampliación invoca el servicio con una cuenta dedicada y mantiene la sesión de administración separada. Los precios, dependencias, prorrateos, promociones, idempotencia y proyección siguen validados por POS.

La revisión cubre los contratos de administración y Billing relacionados con este alta. No es una auditoría exhaustiva de ventas, fiscalidad, stock, hardware o todos los cambios del monorepo. Las herramientas del grafo no estaban disponibles; la evidencia procede de los archivos actuales y pruebas locales.

## Configuración

Conservar las variables actuales de Supabase y añadir opcionalmente:

```dotenv
TICKIT_POS_BILLING_EMAIL=<superadmin_dedicado_del_staging>
TICKIT_POS_BILLING_PASSWORD=<su_contrasena>
```

Ambas deben existir juntas. La cuenta debe estar creada, habilitada y tener `profiles.is_superadmin=true` en **el mismo** Supabase. El MCP no crea ni eleva automáticamente esa identidad. Su ID queda como actor de las operaciones comerciales. No introducir estas credenciales en argumentos de herramientas ni variables públicas. Todos los agentes de la instancia comparten esa identidad y permisos.

Las credenciales son opcionales para conservar el CRUD actual. Sin ellas, `capabilities.billing.configured=false` y las herramientas de facturación devuelven `BILLING_NOT_CONFIGURED`. `configured=true` indica presencia de configuración; comprobar `billing_catalog` para validar autenticación, permisos y disponibilidad de la función. El health general sigue comprobando Data API/Auth Admin.

No configurar claves Stripe en Orbit. Permanecen en las Edge Functions de POS, junto con webhook, Portal y reconciliador. El backend actual acepta **solo claves test**; el MCP conserva **solo staging**. Esto no habilita cobros live.

El entorno necesita estas migraciones ya existentes de POS y sus funciones `billing`, `billing-webhook` y `billing-reconcile` compatibles:

- `20261020174341_stripe_billing_foundation.sql`
- `20261020213005_stripe_billing_failure_reconciliation.sql`
- `20261020221050_billing_immediate_promotions.sql`

El MCP no aplica migraciones ni despliega funciones. Configuración, publicación y aceptación remotas se realizan por el procedimiento autorizado del entorno.

## Herramientas

Todas llevan el prefijo `tickit_pos_billing_`:

| Sufijo | Uso |
| --- | --- |
| `catalog` | Productos, tarifas y funciones; lectura |
| `overview` | MRR/ARR, cobros, estados y supervisión; lectura |
| `get` | Contrato, derechos, recursos, últimas 100 facturas, 50 operaciones y 100 entradas de auditoría |
| `catalog_save` | Producto y nueva versión de tarifa; importes en céntimos |
| `catalog_publish` | Publicar la tarifa en Stripe test |
| `settings` | Ficha interna y gracia por impago |
| `quote` | Presupuesto persistido para plan, addons, asignaciones y excepciones |
| `confirm` | Aplicar el presupuesto; puede crear Checkout o cambiar/cobrar una suscripción existente |
| `quote_cancel` | Presupuesto de cancelación inmediata o al vencimiento |
| `portal` | Enlace temporal para datos fiscales, pago e histórico |
| `reconcile` / `reconcile_batch` | Sincronizar estado con Stripe; lote de hasta veinte cuentas |
| `retry_operation` / `retry_event` | Recuperar una operación original o un evento fallido |

Solo `catalog` y `overview` son de lectura. Todas las demás requieren `confirm:true`; incluso `get` puede inicializar una cuenta interna por el comportamiento actual de POS. El modo solo lectura global o del módulo oculta y bloquea esas escrituras. Una vista previa no activa el contrato, pero persiste un presupuesto y puede materializar precios/cupones.

Los identificadores superiores usan `tenant_id`, `operation_id`, `version_id` y `event_id`. `selection`, `product`, `version` y `exception` conservan los campos camelCase de POS. No se admiten acciones, actor, precios Stripe ni importes arbitrarios en la selección. Solo el editor comercial y las excepciones aceptan sus importes declarados. POS valida que las asignaciones pertenezcan a la empresa y que límites y dependencias sean compatibles con su uso.

En `quote`, enviar `exception:null` aplica la semántica actual de POS. Para Superadmin, las promociones existentes se conservan si se omite `promotions`; retirarlas requiere un acuerdo explícito con `promotions:[]`. No interpretar null como borrado universal de acuerdos.

## Flujo de un agente

El prompt `tickit_pos_company_onboarding`, anunciado en capabilities, guía el proceso. Los pasos son independientes y conservan sus IDs; no hay una transacción distribuida entre Auth, Postgres y Stripe.

1. Consultar capacidades y `billing_catalog`. Seleccionar tarifas publicadas y funciones/capacidad acordadas. Si falta una tarifa, crearla y publicarla con condiciones explícitas, sin inventar importes.
2. Buscar empresa por slug y usuario por email antes de crear. Crear empresa con `tenants_create` y propietario con `users_create`, `role:"owner"`, `tenant_id` y contraseña explícita. Para una cuenta existente autorizada, usar `access_grant`.
3. Crear local, caja si corresponde y dispositivos con las herramientas existentes. Crear cada login con `users_create`, `role:"cashier"`, `tenant_id` y `device_id`, o conceder acceso a una cuenta existente. No confundir el registro de dispositivo con su login. KDS necesita producción contratada/habilitada y un destino activo compatible.
4. Completar `billing_settings`; su ficha interna no actualiza los datos fiscales de un cliente Stripe ya existente. Eso se hace en Portal.
5. Solicitar `billing_quote` con plan y addons. Las asignaciones usan IDs existentes de esa empresa. Para ampliaciones, contratar primero capacidad si el límite actual impide crear los recursos adicionales.
6. Revisar importe inmediato, recurrente, renovación, impuestos y promociones; confirmar con `billing_confirm` usando el ID del presupuesto acordado. La vista previa dura cinco minutos y POS vuelve a validar Stripe y la revisión del contrato.
7. Si devuelve `url` de Checkout, entregarla al cliente para completar el pago. `payment_pending` no significa activación. Ejecutar `billing_reconcile` y `billing_get` para verificar suscripción, contrato y derechos efectivos.
8. Encender las operaciones contratadas con `venue_operations_configure`: `venue_id`, `data` con `tables_enabled`, `production_enabled` o `inventory_enabled`, y `confirm:true`. Activar producción enciende también mesas; apagar mesas apaga producción. No cambia `tenant_feature_assignments` ni `venue_addon_assignments`. Desactivar exige que no haya cajas/comandas abiertas o arrastradas. Crear los KDS después de activar producción y preparar sus destinos.

El contrato puede incluir Tickit Assist, pero su interruptor local sigue requiriendo un owner/manager en CRM: `guard_tickit_assist_venue_config` exige membresía y acceso de usuario al local, incluso para una escritura directa service-role. Esta ampliación respeta esa protección y no expone dicho flag. Habilitarlo desde un superadmin MCP requeriría ampliar expresamente el contrato de autorización de POS.

Ejemplo de presupuesto (sustituir todos los UUID y las claves por valores del catálogo y de la empresa):

```json
{
  "tenant_id": "<uuid_empresa>",
  "selection": {
    "planVersionId": "<uuid_tarifa_plan>",
    "addons": [{
      "key": "<clave_producto_addon>",
      "versionId": "<uuid_tarifa_addon>",
      "quantity": 1,
      "venueIds": ["<uuid_local>"],
      "deviceIds": []
    }]
  },
  "exception": null,
  "reason": "Alta con las condiciones acordadas",
  "confirm": true
}
```

`billing_confirm` recibe `tenant_id`, `operation_id` (el `id` devuelto por quote) y `confirm:true`. Los aumentos pueden aplicarse/cobrarse inmediatamente; las reducciones y otros cambios se programan según las reglas del servicio POS. No modificar después los complementos con `platform_tenant_configure` para intentar forzar acceso.

## Fallos y límites de verificación

No se reintentan escrituras automáticamente. Un fallo de transporte, respuesta inválida o conflicto puede dejar resultado económico incierto; los errores conservan empresa y operación cuando se conocen. POS puede comunicar un fallo incierto como HTTP 409, por lo que ese estado también requiere inspección. Consultar `get`/`reconcile` y recuperar con `retry_operation` y el **mismo ID**. La recuperación automática de POS está limitada a menos de 23 horas; después requiere conciliación manual. No generar un presupuesto sustituto ni borrar la empresa para compensar un cobro incierto.

Eliminar una empresa no cancela Stripe. Las FK de `billing_accounts` y sus registros financieros bloquean el borrado de empresas con historial de facturación; conservarlas y tramitar la cancelación mediante presupuesto/confirmación.

La cuenta Auth de facturación inicia una sesión aislada por llamada; sus tokens no sustituyen el cliente service-role ni se devuelven al agente. Las respuestas comparten el límite de 4 MiB y timeout de 15 segundos por petición. Un timeout puede ocurrir antes de terminar la ejecución remota. Los errores no exponen cuerpos privados de Stripe/Supabase.

`tests/tickit-billing.test.mjs` usa SDK y protocolo MCP reales con transporte simulado. Comprueba el flujo de alta y pago pendiente/activación simulada, permisos, concurrencia, privacidad, recuperación y los cuerpos generados frente a `tests/fixtures/tickit-billing-schemas.mjs`, snapshot identificado del validador POS. La activación económica y los cálculos de Stripe no se simulan como prueba de aceptación remota. Esa aceptación requiere el entorno configurado y un pago sandbox de prueba.

Verificación local de esta entrega: `rtk pnpm test:mcp` pasa 70/70 pruebas y `rtk pnpm build` compila. `git diff --check` pasa. `rtk pnpm lint` no puede arrancar porque `eslint` no está instalado en Orbit; como comprobación adicional se ejecutó el Oxlint ya instalado en POS sobre los siete archivos MJS nuevos/modificados, sin errores. No se añadió ninguna dependencia. El build de Next informa que omite validación de tipos; las pruebas importan y ejecutan los módulos MCP modificados.

Referencias: [ciclo de suscripciones Stripe](https://docs.stripe.com/billing/subscriptions/overview), [invocación de Edge Functions](https://supabase.com/docs/reference/javascript/functions-invoke).
