# Orbit: instalacion nueva en PocketBase 0.40.5

Para conectar un agente de IA a las funciones de Orbit, consulta la [guía del servidor MCP](../docs/mcp.md), con transporte local stdio y Streamable HTTP autenticado.

Orbit empieza desde cero: la migracion crea las colecciones vacias, sin importar datos, cuentas, contrasenas ni sesiones de Supabase. No introduce registros de ejemplo.

La web usa el SDK oficial y cuentas de la coleccion `users`, siguiendo el patron de Mess. La monitorizacion se ejecuta en hooks del servidor. Usa una instancia y un volumen de datos propios para Orbit.

El esquema incluye clientes, comerciales, gastos, facturas, pagos, suscripciones, ingresos, servidores, metricas, credenciales, notificaciones, actividad y ajustes. No incluye proyectos, tareas, calendario, equipo, GitHub, hitos, reuniones ni listas de tareas. Los perfiles de acceso viven en `users`.

## Desplegar PocketBase

En Coolify crea una aplicacion Dockerfile con contexto `/pocketbase`, Dockerfile `/pocketbase/Dockerfile`, puerto **8080**, dominio HTTPS propio y volumen persistente en **`/app/pb_data`**. Si el directorio base ya es `/pocketbase`, el Dockerfile relativo es `/Dockerfile`. El healthcheck es `/api/health`.

La imagen incluye `pb_migrations` y `pb_hooks`. `serve` aplica las migraciones pendientes; `--automigrate=0` desactiva la generacion automatica de nuevas migraciones. Conserva el mismo volumen en los redeploys.

Para instalar sin Docker, copia ambas carpetas junto al ejecutable PocketBase **0.40.5** y ejecuta:

```sh
./pocketbase migrate up --dir=./pb_data --migrationsDir=./pb_migrations
./pocketbase serve --http=0.0.0.0:8090 --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks --automigrate=0
```

La migracion requiere una instancia nueva, sin cuentas previas en `users`. No vacia una instancia existente.

## Crear el workspace y las cuentas

Abre el panel de PocketBase en `/_/` y crea un superusuario. Tambien puedes crearlo en el servidor sobre el mismo directorio persistente:

```sh
./pocketbase superuser upsert 'administrador@tu-dominio.com' 'UNA_CONTRASENA_NUEVA_Y_LARGA' --dir=./pb_data
```

En el panel:

1. Crea un registro en **`organizations`** con el nombre del workspace, `plan` (por ejemplo `Business`), `currency` (`EUR`) y, si procede, `cif`.
2. Crea tu cuenta en **`users`** con email, contrasena nueva, nombre, `role=admin` y **`organization_id` asociado al workspace**.
3. Crea las demas cuentas de acceso con `role=user` y su workspace correspondiente.

Orbit inicia sesion contra `users`, no contra `_superusers`. No hay registro publico de cuentas. Cada usuario solo accede a los datos de su workspace y a sus preferencias personales. Las cuentas no pueden cambiar su propio rol ni workspace. Los administradores pueden editar los datos del workspace y el estado de sus integraciones.

Los superusuarios administran el servidor. Sus credenciales nunca deben aparecer en variables `NEXT_PUBLIC_*` de la web.

### Credenciales vacias y altas rechazadas por la regla de acceso

Si puedes iniciar sesion pero no ves credenciales y el log del alta indica `create rule failure: sql: no rows in result set`, comprueba primero que tu cuenta de `users` tiene `organization_id` y que coincide con el workspace de las credenciales. El login no exige ese campo; las reglas de datos si.

`scripts/diagnose-credentials-workspace.sql` muestra la asignacion de la cuenta y los recuentos por workspace, sin mostrar passwords. Sustituye `TU_EMAIL_ORBIT` por tu email antes de ejecutarlo. Si falta la asignacion, puedes corregirla desde el panel en `users` o con `scripts/fix-credentials-workspace.sql`: indica tu email y, si hay varias organizaciones, el ID correcto. El SQL actualiza solo esa cuenta, sin modificar roles ni credenciales.

Despues pulsa Reintentar o recarga Orbit para renovar la informacion de la sesion. Si la asignacion ya era correcta, revisa el resultado del diagnostico antes de cambiarla. La aplicacion muestra un aviso de configuracion cuando falta el workspace o no se puede acceder a el, en lugar de mostrar listas vacias y permitir altas que fallaran.

## Configurar la web

La URL de la instancia queda pendiente hasta el despliegue. Entonces configura en el entorno de build de la web:

```dotenv
NEXT_PUBLIC_POCKETBASE_URL=https://DOMINIO-POCKETBASE-ORBIT
# Opcional, solo despues de configurar el proveedor OAuth2 en users:
# NEXT_PUBLIC_POCKETBASE_OAUTH_PROVIDER=oidc
```

Para desarrollo local puedes usar `http://127.0.0.1:8090`, como en `.env.example`.

```sh
pnpm install --frozen-lockfile
pnpm build
```

Next incorpora `NEXT_PUBLIC_*` al build: recompila y redespliega si cambia la URL. La web no necesita clave anon, conexion PostgreSQL ni credenciales de servicio. Inicia sesion con las cuentas nuevas de PocketBase.

Si habilitas acceso con Alteil, configura primero ese proveedor OAuth2 en `users`. Para recuperar contrasenas configura SMTP en PocketBase.

## Dar de alta servidores

Registra los servidores desde Orbit. Cada alta genera un ID y un token privado nuevo para el agente. Sigue [la guia de monitorizacion](../docs/server-monitoring.md) para instalar el script y configurar la URL de PocketBase.

Los hashes de los tokens no se devuelven al navegador. Los reportes actualizan el servidor y crean su historial dentro de una transaccion. Los usuarios no pueden escribir metricas directamente en las colecciones.

## Validacion local

Descarga el ejecutable oficial PocketBase 0.40.5 y define `POCKETBASE_TEST_BINARY`, o guardalo en `.pocketbase-test/pocketbase.exe` en Windows (`pocketbase` en Linux). Usa Node 24.

```sh
pnpm test:pocketbase
pnpm build
```

Las pruebas crean una base local aislada, comprueban `up/down/up` y que todas las colecciones arrancan vacias. Despues crean cuentas nuevas para verificar login, reglas entre workspaces, CRUD, preferencias y monitorizacion. No usan datos ni servicios de produccion.

La reversion de la migracion inicial elimina las colecciones y sus registros. Usala solo en pruebas o restaura una copia de `pb_data` si necesitas revertir una instalacion en uso.

## Comerciales y asignación de clientes

La sección **Comerciales** permite crear, editar y eliminar comerciales y consultar sus clientes. Cada comercial puede tener cero o muchos clientes; cada cliente tiene un único comercial opcional. La asignación también se puede cambiar o quitar desde la ficha del cliente, y elegir al darlo de alta. El listado de clientes permite filtrar por comercial o por clientes sin asignar.

La migración `1792713600_sales_reps.js` añade la colección `sales_reps` y la relación opcional `clients.sales_rep_id` a instalaciones existentes, conservando sus clientes sin asignar. Despliega las migraciones y los hooks de PocketBase antes de publicar la nueva web. Las relaciones solo admiten comerciales del mismo workspace. Al eliminar un comercial, se conservan sus clientes y se elimina su asignación.

## Ciclos de facturación, MRR y ARR

Cada cliente tiene un ciclo opcional y un importe por ciclo sin IVA. Los ciclos disponibles son mensual, bimestral, trimestral, semestral, anual y puntual. Pueden configurarse al crear el cliente o editarse desde su ficha. Los importes admiten cero y hasta dos decimales.

La tarjeta de ingresos recurrentes de Clientes suma todos los clientes activos, independientemente de los filtros de la lista. Convierte cada ciclo recurrente a su equivalente mensual para el MRR; el ARR representa ese ingreso anualizado. Los ciclos sin configurar y puntuales, los importes cero y los clientes que no estén activos quedan excluidos. Se calcula en céntimos anuales y se redondea el total mensual una sola vez; el ARR conserva sus céntimos originales.

La migración `1792717200_client_billing.js` añade `clients.billing_cycle` y `clients.billing_amount` sin modificar facturación histórica ni asignaciones comerciales. Los clientes existentes empiezan sin configurar y con importe cero. Despliega esta migración y los hooks actualizados antes de la nueva web.

Pruebas del cálculo y validación: `node --test tests/client-billing.test.mjs`.

## Gastos, IVA y ciclos de cobro

La sección **Gastos** permite crear, editar, pausar y eliminar gastos del workspace, con nombre, proveedor, categoría, base por cobro sin IVA, tratamiento de IVA, ciclo, fecha prevista opcional y notas. Dispone de búsqueda y filtros por estado, categoría y ciclo. La fecha prevista se actualiza manualmente al editar; no se registra un historial de pagos ni se avanza automáticamente.

Incluye porcentajes predefinidos del 21 %, 10 %, 4 % y 0 %, además de otro porcentaje (0–100 %, hasta dos decimales), exento, no sujeto e inversión del sujeto pasivo. Los tipos españoles se contrastaron con [la AEAT](https://sede.agenciatributaria.gob.es/Sede/iva/calculo-iva-repercutido-clientes/tipos-impositivos-iva.html). El usuario selecciona el tratamiento según su factura: no se asigna automáticamente por categoría. Exento, no sujeto e inversión del sujeto pasivo se distinguen del tipo cero y requieren porcentaje cero. El total representa el pago al proveedor; no calcula autorrepercusión, IVA deducible ni liquidaciones fiscales.

El IVA se redondea a céntimos por cobro. Los resúmenes convierten los ciclos mensual, bimestral, trimestral, semestral y anual a equivalentes mensuales y anuales, excluyendo gastos puntuales y pausados, independientemente de los filtros. La base y el IVA mensuales se redondean a céntimos por separado y el total mostrado suma ambos. Son equivalentes de costes, no salidas de caja reales de un mes concreto.

La migración `1792720800_expenses.js` crea la colección vacía `expenses` con reglas de aislamiento por workspace. Despliega migraciones y hooks antes de publicar la web. Conserva los clientes, comerciales y su facturación.

Verificación: `node --test tests/expenses.test.mjs tests/client-billing.test.mjs` y `pnpm test:pocketbase`.

## Estadísticas

La sección **Estadísticas** compara los ingresos recurrentes de clientes activos con los gastos recurrentes activos sin IVA, muestra beneficio operativo y margen estimados, permite simular 3, 6 o 12 meses, clasifica la cartera actual por comercial y desglosa costes por categoría. La facturación registrada se muestra por separado según las facturas emitidas. No requiere una migración adicional.

Consulta [las fórmulas, fuentes y límites de las estadísticas](../docs/statistics.md). Pruebas: `node --test tests/statistics.test.mjs tests/expenses.test.mjs tests/client-billing.test.mjs`.

## Comisiones por cliente

Desde **Comerciales**, abre la cartera y configura la comisión de cada cliente según el plan Tickit POS: bono de alta (media cuota en Basic), 10 % de la mensualidad 3 a la 60 y reversión del bono por baja o impago antes de cobrar la cuarta cuota. Las condiciones son personalizables por cliente. Los importes generados se calculan únicamente con mensualidades de software cobradas y registradas, sin IVA, hardware ni instalación; se distinguen de las estimaciones y de los pagos al comercial.

Despliega primero `1792807200_sales_commissions.js` y los hooks completos, incluida su carpeta `lib`, antes de publicar la web. La nueva colección arranca vacía y conserva titular e historial aunque se reasigne un cliente. Los comerciales con acuerdos no se eliminan. Consulta [el modelo, los ejemplos y la configuración de comisiones](../docs/sales-commissions.md).
