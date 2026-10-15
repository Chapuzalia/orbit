# Orbit: instalacion nueva en PocketBase 0.40.5

Orbit empieza desde cero: la migracion crea las colecciones vacias, sin importar datos, cuentas, contrasenas ni sesiones de Supabase. No introduce registros de ejemplo.

La web usa el SDK oficial y cuentas de la coleccion `users`, siguiendo el patron de Mess. La monitorizacion se ejecuta en hooks del servidor. Usa una instancia y un volumen de datos propios para Orbit.

El esquema incluye clientes, facturas, pagos, suscripciones, ingresos, servidores, metricas, credenciales, notificaciones, actividad y ajustes. No incluye proyectos, tareas, calendario, equipo, GitHub, hitos, reuniones ni listas de tareas. Los perfiles de acceso viven en `users`.

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
