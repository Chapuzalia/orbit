# MCP de Orbit

Servidor MCP para conectar agentes a las funciones de negocio de Orbit. Usa el SDK oficial `@modelcontextprotocol/sdk` 1.29.0, con transportes **stdio** y **Streamable HTTP**. Se ejecuta como un proceso independiente de Next.js y utiliza la misma instancia PocketBase y sus reglas de acceso.

## Arranque local

Requiere Node.js 24 y las migraciones y hooks actuales de Orbit desplegados en PocketBase.

1. Ejecuta `pnpm install --frozen-lockfile`.
2. Copia `.env.mcp.example` a `.env.mcp.local`.
3. Configura `ORBIT_POCKETBASE_URL` y una cuenta de `users` mediante `ORBIT_USER_EMAIL` y `ORBIT_USER_PASSWORD`. También puedes usar `ORBIT_USER_TOKEN` en lugar de email y contraseña. Si configuras ambos, tiene prioridad el token.
4. La cuenta necesita `organization_id`. Usa `role=admin` si el agente debe editar el workspace o las integraciones. Las cuentas `user` conservan las restricciones de PocketBase.
5. Ejecuta `pnpm mcp`. Con stdio el proceso espera mensajes MCP en la entrada estándar; eso es lo esperado.

Los secretos son variables de servidor. `.env.mcp.local` está excluido de Git. El servidor no lee las sesiones del navegador ni necesita un superusuario. Refresca la autenticación y comprueba el workspace en cada llamada, sin compartir sesiones entre peticiones. Un token expirado debe sustituirse; con email y contraseña se inicia una sesión nueva por llamada. No se reintentan escrituras automáticamente.

### Configuración de un cliente MCP por stdio

Ejemplo para clientes que aceptan `mcpServers`. Sustituye ambas rutas por las rutas absolutas de tu instalación. El archivo de entorno se resuelve desde su propia ruta, independientemente del directorio del cliente. El uso directo de `node` mantiene stdout reservado al protocolo.

```json
{
  "mcpServers": {
    "orbit": {
      "command": "node",
      "args": [
        "--env-file=C:/ruta/orbit/.env.mcp.local",
        "C:/ruta/orbit/mcp/index.mjs"
      ]
    }
  }
}
```

También se pueden pasar las variables mediante el campo `env` del cliente. Con esa modalidad no necesitas `--env-file`. No incluyas credenciales reales en archivos versionados.

## Funciones disponibles

Ejecuta `orbit_capabilities` o lee `orbit://capabilities` para obtener el catálogo efectivo. Los nombres siguen `orbit_<colección>_<operación>`; las operaciones generales son `list`, `get`, `create`, `update` y `delete`. Los campos utilizan los nombres de PocketBase en `snake_case`.

| Área | Funciones |
| --- | --- |
| Clientes | CRUD, asignar/quitar comercial con `sales_rep_id`, configurar ciclo e importe sin IVA |
| Comerciales | CRUD; se mantienen las restricciones de sus acuerdos y relaciones |
| Comisiones | Consultar, crear y editar acuerdos, cuotas cobradas, cierre y reversión; `orbit_commission_summary` calcula los importes |
| Gastos | CRUD, IVA, categoría, ciclo, fecha prevista, pausar/reactivar |
| Facturación | CRUD de registros locales de facturas, pagos, suscripciones e ingresos mensuales |
| Estadísticas/dashboard | `orbit_statistics`: MRR, ARR, gastos, beneficio/margen estimados, ranking, categorías, histórico y previsiones de 3/6/12 meses |
| Servidores | Listar, consultar, registrar y eliminar; el alta entrega un token nuevo una sola vez; `effective_status` marca offline tras tres minutos sin reportes |
| Métricas | Consulta paginada del historial; filtra `server_id` y ordena `checked_at` descendente |
| Credenciales | CRUD con secretos ocultos; lectura explícita opcional con `orbit_credentials_reveal` |
| Notificaciones | Listar, consultar, cambiar `read`, eliminar y `orbit_notifications_mark_all_read` |
| Actividad | Lectura del historial |
| Perfil | `orbit_whoami`, `orbit_profile_update` |
| Workspace | Consulta mediante `orbit_whoami`; edición con `orbit_organization_update` (admin) |
| Preferencias | `orbit_preferences_get`, `orbit_preferences_save`: notificaciones y tema guardado |
| Integraciones | CRUD de su configuración/estado en Orbit (admin) |

El prompt MCP `orbit_workspace_review` propone revisar estadísticas, servidores y notificaciones sin modificar datos.

### Ejemplos de argumentos

`orbit_clients_create`:

```json
{ "data": { "name": "Cliente nuevo", "status": "active", "billing_cycle": "monthly", "billing_amount": 99.90 } }
```

`orbit_clients_list`:

```json
{
  "page": 1,
  "per_page": 50,
  "filters": [{ "field": "status", "operator": "eq", "value": "active" }],
  "sort": [{ "field": "name", "direction": "asc" }]
}
```

Los filtros se combinan con AND y admiten `eq`, `ne`, `contains`, `gt`, `gte`, `lt`, `lte`. Los valores se escapan con el SDK de PocketBase. No se aceptan expresiones arbitrarias, expansión de relaciones, campos de sistema para escritura ni cambios de organización. Las listas incluyen información de paginación; el máximo es 100 registros por página. Los informes recorren hasta 10.000 registros por colección y devuelven un error si se supera el límite, sin presentar totales incompletos.

`orbit_clients_update` sirve también para quitar un comercial:

```json
{ "id": "abc123def456ghi", "data": { "sales_rep_id": "" } }
```

`orbit_statistics`:

```json
{ "horizon": 6, "revenueGrowth": 2, "costGrowth": 1 }
```

Las tasas representan variación mensual porcentual. Se reutilizan las fórmulas de la web, incluida la zona horaria Europe/Madrid para los periodos. Las estadísticas son estimaciones sin IVA, no cobros ni liquidaciones.

Cada borrado exige `id` y `confirm: true`. Las actualizaciones aceptan solo los campos que cambian; PocketBase conserva la validación de relaciones y permisos. Las operaciones devuelven JSON estructurado; los fallos de negocio llevan `isError: true`. En el marcado masivo de notificaciones se devuelven los recuentos `updated` y `remaining` y, si hay un fallo parcial, su error.

## Permisos y secretos

- `ORBIT_MCP_READ_ONLY=true` elimina las herramientas de escritura del catálogo y bloquea las escrituras en el servicio.
- `ORBIT_MCP_ALLOW_SECRETS=true` habilita `orbit_credentials_reveal`, que requiere el ID de una credencial. Las listas y respuestas CRUD siguen omitiendo `password`, `recovery` y `notes`, incluso con este permiso habilitado. Los secretos no se pueden usar como campos de filtro u ordenación.
- `ORBIT_ORGANIZATION_ID` permite fijar el workspace esperado. Una cuenta que cambie a otro workspace será rechazada.
- Cada registro nuevo recibe automáticamente la organización de la sesión; las credenciales reciben además `created_by`. Las consultas y las operaciones por ID respetan el workspace y las reglas personales de PocketBase.

Las escrituras de secretos están disponibles con las herramientas CRUD porque forman parte de la gestión de credenciales. El permiso de secretos controla su lectura. El token del agente de monitorización se entrega durante el alta del servidor para poder instalarlo y no se puede recuperar después.

## Streamable HTTP y despliegue

Configura en el entorno:

```dotenv
ORBIT_MCP_TRANSPORT=http
ORBIT_MCP_HOST=127.0.0.1
ORBIT_MCP_PORT=3100
ORBIT_MCP_HTTP_TOKEN=UN_TOKEN_ALEATORIO_DE_AL_MENOS_32_CARACTERES
ORBIT_MCP_ALLOWED_HOSTS=127.0.0.1,localhost,mcp.tu-dominio.com
```

Genera un token, por ejemplo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

El endpoint es `POST /mcp` con `Authorization: Bearer <ORBIT_MCP_HTTP_TOKEN>`. El cliente debe soportar Streamable HTTP y cabeceras de autenticación configurables. Se usa modo stateless, sin sesiones MCP persistentes ni canal GET/SSE. El token HTTP y las credenciales de PocketBase son distintos. Este despliegue representa **una sola cuenta de Orbit**: todos los clientes que tengan el token actúan con esa cuenta. Para cuentas o workspaces diferentes, ejecuta instancias separadas. No implementa un proveedor OAuth ni descubrimiento OAuth para clientes que lo exijan.

Usa un proxy HTTPS para el acceso remoto. Mantén la comprobación de Host mediante `ORBIT_MCP_ALLOWED_HOSTS` (nombres sin protocolo ni puerto), y configura el proxy para conservar ese Host. Las peticiones con cabecera Origin se rechazan salvo inclusión exacta en `ORBIT_MCP_ALLOWED_ORIGINS`. Esta lista permite peticiones de clientes nativos que envíen Origin; el servidor no ofrece una integración CORS para aplicaciones web. Las peticiones están limitadas a 1 MiB. Los errores no muestran cuerpos de PocketBase ni credenciales.

### Docker / Coolify

El proyecto y el Dockerfile fijan pnpm 10.32.1, la versión compatible con el lockfile y con `pnpm.overrides` de `package.json`. Si un build antiguo descarga pnpm 12 y falla con `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, despliega los cambios de `package.json` y `mcp/Dockerfile` y vuelve a construir. Conserva `--frozen-lockfile`.

Construye desde la raíz del repositorio con Dockerfile `mcp/Dockerfile`, puerto 3100, las variables de `.env.mcp.example` y un dominio HTTPS. Configura `ORBIT_MCP_ALLOWED_HOSTS` con ese dominio. La imagen escucha en `0.0.0.0`; PocketBase remoto debe tener HTTPS. La imagen no incluye archivos `.env` ni datos locales.

```sh
docker build -f mcp/Dockerfile -t orbit-mcp .
docker run --rm --env-file .env.mcp.local -e ORBIT_MCP_TRANSPORT=http -e ORBIT_MCP_HOST=0.0.0.0 -p 127.0.0.1:3100:3100 orbit-mcp
```

Dentro del contenedor, `127.0.0.1` apunta al propio contenedor. Configura la URL HTTPS real de PocketBase. No hay endpoint de salud público: el supervisor puede verificar el proceso o el puerto, y una comprobación MCP autenticada puede llamar a `orbit_whoami` para comprobar también PocketBase.

## Límites de las funciones existentes

Crear o editar una factura, un pago o una suscripción guarda datos en Orbit. No emite facturas en Stripe, no carga tarjetas, no envía correos ni automatiza conciliaciones. Cambiar `connected` de una integración modifica el estado que ya utiliza la web, sin iniciar una autorización externa. El MCP no ejecuta SSH ni reinicia servicios y no inventa métricas. El agente del VPS sigue enviando sus reportes al endpoint original. El tema guardado no modifica una sesión de navegador abierta. Las lecturas de informes no son una instantánea transaccional si hay escrituras concurrentes.

## Verificación

Guarda el binario PocketBase 0.40.5 en `.pocketbase-test/pocketbase.exe` (Windows) o define `POCKETBASE_TEST_BINARY`.

```sh
pnpm test:mcp
pnpm test:pocketbase
pnpm build
```

Las pruebas MCP negocian stdio, descubren herramientas/recursos/prompts y usan un PocketBase local aislado para verificar operaciones reales, comisiones, fórmulas, permisos admin/user, aislamiento entre organizaciones, secretos, modo lectura, token de usuario, monitorización y Streamable HTTP autenticado. No usan `.env.local`, cuentas ni datos de producción.

Referencias: [SDK oficial MCP](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x), [documentación oficial para servidores](https://modelcontextprotocol.io/docs/develop/build-server).
