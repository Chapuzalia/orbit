# MCP modular de Alteil

Un endpoint `/mcp`, con núcleo común y módulos independientes. **Orbit** usa PocketBase con su cuenta/workspace. **Tickit POS v3** usa directamente el Supabase de staging con una clave `service_role` o `sb_secret_` y permisos de **superadmin de toda la plataforma**. **MESS** gestiona su calendario de reservas mediante su propio PocketBase; consulta la [configuración y ejemplos de MESS](mcp-mess.md). Tickit no necesita su API Express ni iniciar sesión personalmente en su interfaz.

## Arquitectura y activación

```text
mcp/
  core/                    # Configuración, registro, catálogo y permisos
  transports/              # Streamable HTTP y stdio
  modules/
    orbit/                 # Herramientas de Orbit/PocketBase
    mess/                  # Calendario operativo de reservas MESS/PocketBase
    tickit-pos/
      index.mjs            # Registro de herramientas
      admin-schema.mjs     # Entidades, campos y contratos de administración
      catalog.mjs          # Comandos tipados de catálogo
      supabase-service.mjs # Data API, RPC y selección de destinos
      users.mjs            # Auth Admin, superadmins y accesos globales
```

`ALTEIL_MODULES=orbit,tickit_pos,mess` activa los tres productos. Puedes elegir cualquier combinación. Si se omite se carga solo Orbit, conservando los despliegues anteriores. Cada módulo exige únicamente sus propias credenciales. El registro solo permite módulos incluidos en el código. Reinicia el proceso para cambiar módulos o permisos.

Las variables comunes `ALTEIL_MCP_*` tienen prioridad sobre los antiguos alias `ORBIT_MCP_*` de transporte. Las herramientas `orbit_*` conservan nombres, argumentos y permisos.

| Configuración | Efecto |
| --- | --- |
| `ALTEIL_MCP_READ_ONLY=true` | Oculta y bloquea escrituras de todos los productos |
| `ORBIT_MCP_READ_ONLY=true` | Solo lectura en Orbit |
| `ORBIT_MCP_ALLOW_SECRETS=true` | Permite lectura explícita de contraseñas en Orbit |
| `TICKIT_POS_READ_ONLY=true` | Solo lectura en Tickit |
| `MESS_READ_ONLY=true` | Solo lectura en el calendario de MESS |

El token del endpoint MCP comparte los permisos de sus módulos con todos los agentes que lo utilicen. En Tickit esos permisos son globales: no existe una selección fija de empresa o local como límite de autorización. El transporte usa Bearer, sin OAuth ni permisos individuales por cliente MCP.

## Configuración en Coolify y Grokbot

Dockerfile `mcp/Dockerfile`, contexto raíz, puerto **3100** y dominio HTTPS. Configura estas variables de **Runtime**, sin disponibilidad durante el build:

```dotenv
ALTEIL_MODULES=orbit,tickit_pos
ALTEIL_MCP_TRANSPORT=http
ALTEIL_MCP_HOST=0.0.0.0
ALTEIL_MCP_PORT=3100
ALTEIL_MCP_HTTP_TOKEN=<token_aleatorio_minimo_32_caracteres>
ALTEIL_MCP_ALLOWED_HOSTS=mcp.tu-dominio.com,localhost,127.0.0.1
ALTEIL_MCP_READ_ONLY=false

ORBIT_POCKETBASE_URL=https://POCKETBASE-ORBIT
ORBIT_USER_EMAIL=agente@tu-dominio.com
ORBIT_USER_PASSWORD=<password>
ORBIT_MCP_READ_ONLY=false
ORBIT_MCP_ALLOW_SECRETS=false

TICKIT_POS_ENVIRONMENT=staging
TICKIT_POS_SUPABASE_URL=https://SUPABASE-POS-STAGING
TICKIT_POS_SERVICE_ROLE_KEY=<service_role_o_sb_secret_de_staging>
TICKIT_POS_READ_ONLY=false
```

Si solo quieres Tickit, utiliza `ALTEIL_MODULES=tickit_pos` y omite las credenciales de Orbit.

`TICKIT_POS_SUPABASE_URL` es el origen de Supabase, sin `/rest/v1` ni otras rutas; HTTP solo está permitido en loopback para pruebas. La clave permanece en el servidor, sin prefijo `NEXT_PUBLIC_` ni `VITE_`. No necesitas una credencial `tk_`, `TICKIT_POS_API_URL` o `TICKIT_POS_API_KEY`.

**No configures `TICKIT_POS_TENANT_ID` ni `TICKIT_POS_VENUE_ID`.** Los valores antiguos se ignoran: ya no limitan ni seleccionan por defecto una empresa/local. Debes volver a desplegar para utilizar v3.

El módulo admite únicamente `TICKIT_POS_ENVIRONMENT=staging`. Proporciona la URL y clave del staging correcto; la etiqueta de entorno no comprueba a qué proyecto corresponde una URL.

En Grokbot configura un servidor MCP con transporte **Streamable HTTP**:

```text
URL: https://mcp.tu-dominio.com/mcp
Authorization: Bearer <ALTEIL_MCP_HTTP_TOKEN>
```

Grokbot solo necesita ese token, no la clave de Supabase. Si su conector admite únicamente OAuth y no cabeceras Bearer, necesitará soporte de autenticación compatible para conectarse a este endpoint.

## Descubrir herramientas

- `alteil_modules`: productos, versiones, permisos y alcance sin mostrar secretos.
- `alteil_capabilities`: catálogo efectivo de todos los productos.
- `alteil_module_health` con `{"module":"tickit_pos"}`: comprueba Data API y Auth Admin mediante lecturas.
- `tickit_pos_capabilities`: entidades, campos, operaciones y comandos habilitados.
- `tickit-pos://capabilities`: recurso de herramientas y límites sin acceder al backend.

La respuesta de Tickit incluye `access:"platform_superadmin"` y `scope:"platform"`. Una caída de Tickit no impide usar Orbit. Health no certifica todas las migraciones: staging debe tener las tablas y RPC actuales del monorepo POS.

## Administración de plataforma

Tickit publica **147 herramientas** con escrituras habilitadas. Cada escritura exige `confirm:true`; el modo lectura las oculta y bloquea también en ejecución.

| Área | Herramientas y alcance |
| --- | --- |
| Empresas | `tenants_list/get/create/update/delete`; alta, edición, activación y borrado de cualquier empresa |
| Plan y funciones | `platform_features_list`, `tenant_feature_assignments_list`, `platform_tenant_configure` |
| Usuarios globales | `users_list/get/create/update/delete`, incluidos superadmins, cuentas compartidas y cuentas sin empresa |
| Accesos | `access_grant/revoke`: owner/manager/cashier en cualquier empresa; cambio de rol y reactivación |
| Catálogo | Productos, variantes, pestañas, categorías, formatos, ubicaciones, selecciones, modificadores, orden e imágenes |
| Locales y terminales | Listar, crear y editar locales, dispositivos y capacidades |
| Clientes y proveedores | Listar, crear y editar |
| Mesas | Zonas, mesas y geometría |
| Inventario y producción | Gestión de unidades, almacenes, destinos y pases; consultas de existencias, movimientos, lotes y elementos |
| Negocio | Consultas de ventas, tickets, comandas, cajas, reservas, descuentos y documentos de proveedor |

Todos los nombres llevan prefijo `tickit_pos_`. Las entidades generales siguen `<tabla>_list/get/create/update/delete`; solo se registran operaciones declaradas. Los campos generales usan `snake_case`; los comandos de catálogo mantienen `camelCase` de los RPC del POS.

Las listas sin destino consultan toda la plataforma. Puedes filtrarlas con `tenant_id` o `venue_id`. Admiten además `page`, `per_page` (1–100), `filters` y `sort`; devuelven `items` y `has_more`. Los filtros solo aceptan los campos y operadores declarados.

Para crear datos de empresa indica `tenant_id`; para datos de local indica `venue_id` y el servidor deduce su empresa. En consultas y ediciones por `id` se deduce el destino del registro. Puedes proporcionar ambos identificadores y se comprueba su coherencia. No hay una variable global mutable que cambie de empresa entre peticiones.

Las relaciones siguen correspondiendo a su empresa/local: un producto de un local no puede utilizar un formato de otro. Esta comprobación conserva la integridad de los datos; el superadmin puede administrar ambos locales indicando el destino correcto.

`platform_tenant_configure` recibe `tenant_id`, `name`, `slug`, `max_venues`, `max_devices`, `feature_keys` y `confirm:true`. Sustituye la configuración completa de funciones mediante `update_platform_tenant_config`, usando los marcadores actuales de catálogo de addons y Assist. Conserva las validaciones nativas de uso, límites y facturación; no elude contratos de Stripe. La actualización genérica de empresas no permite modificar límites.

Para incorporar un negocio puedes crear la empresa con `tenants_create`, su local con `venues_create` y su propietario con `users_create`. El local comienza con catálogo custom vacío. Son pasos independientes, no una transacción única. `tenants_delete` elimina la empresa y sus datos según las cascadas de Postgres, conserva las cuentas Auth y bloquea si existen cajas/comandas abiertas.

## Usuarios y accesos

Alta de superadmin de plataforma con `tickit_pos_users_create`:

```json
{
  "email": "admin@example.com",
  "password": "<password_de_8_a_72_caracteres>",
  "full_name": "Administración",
  "role": "superadmin",
  "confirm": true
}
```

`role:"user"` crea una cuenta sin privilegios ni membresías. `role:"superadmin"` establece el indicador real `profiles.is_superadmin:true`. Ninguno necesita empresa. No se usa `user_metadata` para autorización ni se emite un JWT `service_role` al usuario.

Alta de manager en cualquier empresa:

```json
{
  "email": "manager@example.com",
  "password": "<password_de_8_a_72_caracteres>",
  "full_name": "Responsable",
  "role": "manager",
  "tenant_id": "<uuid_empresa>",
  "venue_ids": ["<uuid_local>"],
  "confirm": true
}
```

Owner requiere `tenant_id`; manager requiere también `venue_ids`; cashier requiere `device_id` disponible de esa empresa. Auth permanece bloqueado durante el alta y solo se habilita tras crear perfil y accesos. `email_confirm` es true por defecto; no se envían correos. Si falla el alta, se intenta eliminar exclusivamente la cuenta recién creada y se comunica el resultado. Un email existente no se reutiliza automáticamente.

`users_list` lista Auth globalmente, incluidas cuentas sin membresía y superadmins; `tenant_id` es un filtro opcional. `users_get` devuelve todas las membresías, asignaciones de manager y dispositivos del usuario, además de su perfil y estado Auth, sin tokens ni contraseñas.

`users_update` modifica cualquier cuenta compartida o superadmin: `email`, `password`, `full_name`, `is_superadmin`, `email_confirm` y `ban_duration` (`none` o duración como `24h`). No requiere entrar a Tickit.

`access_grant` recibe `user_id`, `tenant_id`, `role` y las asignaciones correspondientes. Concede acceso nuevo, cambia el rol o reactiva la membresía. Un usuario puede pertenecer a varias empresas. Para managers reemplaza los locales con `set_manager_venue_assignments`; para cashiers respeta la ocupación del dispositivo. Al pasar a otro rol retira las asignaciones anteriores que ya no aplican. Una configuración incompleta informa la etapa fallida y si pudo restaurar la membresía previa; las asignaciones pueden requerir reparación.

`access_revoke` recibe `user_id` y `tenant_id`: desactiva esa membresía y sus accesos de dispositivo, incluidos propietarios, sin eliminar otras membresías ni Auth. El indicador superadmin es independiente: para retirar privilegios globales utiliza `users_update` con `is_superadmin:false`.

`users_delete` es un borrado **global**: bloquea Auth, desactiva el indicador superadmin y todos los accesos, y elimina la cuenta Auth. Incluye owners, superadmins y cuentas compartidas. Si falla un paso informa cuáles se completaron. Revocar, cambiar acceso o borrar usuarios requiere cerrar sus cajas/comandas abiertas; el borrado comprueba todas las empresas.

Auth y Data API no forman una transacción distribuida. Las respuestas inciertas de escritura incluyen `outcome_unknown:true` cuando corresponde: consulta el estado e IDs antes de repetir. Los JWT ya emitidos pueden seguir vigentes hasta caducar; los recursos externos que solo validan JWT no garantizan revocación instantánea.

## Catálogo

Ejemplo de `tickit_pos_products_create` en cualquier local:

```json
{
  "venue_id": "<uuid_local>",
  "confirm": true,
  "data": {
    "type": "standard",
    "name": "Café",
    "vatRate": 10,
    "variants": [{ "name": "Unidad", "priceCents": 150, "formatId": "<uuid_formato>", "isDefault": true }]
  }
}
```

`priceCents` y `supplementCents` son céntimos enteros; `vatRate` es un porcentaje. Si una variante nueva usa formato, todas deben tenerlo. Consulta formatos con `catalog_sale_formats_list` y créalos con `sale_formats_save`.

Las herramientas reutilizan `get_catalog`, `catalog_command`, `catalog_command_batch_with_formats`, `catalog_variant_format_command`, `catalog_sale_format_command`, `catalog_tab_category_command` y `catalog_image_command`. Conservan transacciones y validaciones del POS. Crear producto con variantes y formatos es una única transacción SQL.

`products_update` y `products_delete` requieren `venue_id` y `data.id`. `catalog_get` requiere `venue_id` y admite `mode:"admin"` o `"pos"`.

Las herramientas de imagen registran archivos existentes bajo `<tenant>/<venue>/products/`. No suben archivos ni descargan URLs. Los paths huérfanos devueltos por los RPC se comunican y no se borran automáticamente de Storage.

## Alcance y verificación

- `service_role` omite RLS. Este módulo ofrece deliberadamente acceso global y mantiene validación de campos, relaciones, triggers, constraints y límites nativos. No cambia las políticas de la aplicación Tickit.
- Se usa Data API y Auth Admin, sin contraseña Postgres. No hay SQL ni tablas/RPC arbitrarios.
- Ventas, pagos, tickets, cierres, fiscalidad y stock se consultan; sus escrituras requieren contratos transaccionales específicos. El acceso superadmin no añade por sí solo herramientas todavía no implementadas.
- Respuestas limitadas a 4 MiB, timeout por petición y reintentos automáticos de PostgREST deshabilitados.
- Los módulos comparten proceso y son código confiable del despliegue.

`pnpm test:mcp` verifica Orbit con PocketBase aislado, negociación MCP, permisos por módulo y SDK real de Supabase con transporte simulado. Cubre administración global, cuentas compartidas, superadmins, cambios de rol, compensaciones, filtros, integridad de referencias y operaciones concurrentes en distintas empresas.

`tests/fixtures/tickit-catalog.sql` conserva un snapshot identificado del SQL del POS. PGlite ejecuta esos RPC reales y comprueba formatos, céntimos, rollback y coherencia de local. Los helpers de identidad se sustituyen solo en la base aislada de pruebas.

La implementación no despliega servicios, aplica migraciones ni utiliza credenciales reales. Configura el entorno, redespliega y ejecuta `alteil_module_health` para comprobar tu staging.

## Añadir un producto

Un módulo exporta `loadModule(env)` y devuelve `id`, `version`, `description`, `config.readOnly`, `metadata()`, `health()`, `formatError()` y `register({server,register,catalog})`. Registra herramientas con su propio prefijo y esquemas Zod. El núcleo impide colisiones y comprueba permisos. Añade su loader a `mcp/core/registry.mjs`, pruebas y variables, construye y actívalo con `ALTEIL_MODULES`.
