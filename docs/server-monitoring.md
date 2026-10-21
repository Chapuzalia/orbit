# Monitorizacion de servidores

Orbit monitoriza servidores con un agente ligero instalado en cada VPS.

## Que mide

- CPU: calculada desde `/proc/stat`.
- RAM: calculada desde `MemTotal` y `MemAvailable`.
- SSD/disco: porcentaje de uso de `df` sobre `ORBIT_DISK_PATH`, por defecto `/`.
- Online/offline: cada reporte actualiza `last_check`; la app marca offline si no hay reporte en 3 minutos.
- Historial: cada reporte crea una fila en `server_metrics`.

La grafica consulta solo los 48 registros mas recientes del servidor abierto, con los campos de CPU, RAM, disco y fecha. La consulta usa el indice existente `(server_id, checked_at)`, no cuenta el historico completo y se actualiza cada 30 segundos mientras el detalle esta abierto y el servidor tiene conexion. Al salir del detalle se cancela la consulta pendiente y su temporizador. El arranque de Orbit y las demas pantallas no descargan historiales; las lecturas actuales se obtienen de `servers`.

## Configuracion en PocketBase

Aplica el esquema y copia los hooks segun [la guia de migracion](../pocketbase/README.md). Los endpoints son `POST /api/orbit/servers` (usuario autenticado del workspace) y `POST /api/orbit/server-metrics` (token privado del agente). Las tablas de metricas no permiten escrituras directas desde el navegador.

Los tokens se guardan como hash y no se devuelven al cliente. Cada reporte actualiza el servidor y crea su historial dentro de la misma transaccion.

Si restauras servidores antiguos mediante SQL, el hook tambien admite sus hashes bcrypt originales. Despliega la version actualizada de `pocketbase/pb_hooks/orbit.pb.js` y reinicia PocketBase antes de enviar reportes con esos tokens. Conserva el token original del agente, pero actualiza `POCKETBASE_URL`, `ORBIT_SERVER_ID` y el script del agente. La restauracion de un registro de servidor conserva la ultima lectura; el historico de `server_metrics` requiere su propia exportacion.

## Alta desde la app

1. Ve a `Servidores`.
2. Pulsa `Nuevo servidor`.
3. Rellena los datos.
4. Guarda el `Server ID` y el `Agent token`; el token solo se muestra una vez.

## Instalacion en un VPS Linux

Copia el script y el service:

```bash
sudo install -m 0755 orbit-server-agent.sh /usr/local/bin/orbit-server-agent.sh
sudo install -m 0644 orbit-server-agent.service /etc/systemd/system/orbit-server-agent.service
```

Crea `/etc/orbit-server-agent.env`:

```bash
POCKETBASE_URL=https://DOMINIO-POCKETBASE-ORBIT
ORBIT_SERVER_ID=ID_POCKETBASE_DEL_SERVIDOR
ORBIT_SERVER_TOKEN=TOKEN_PRIVADO_DEL_AGENTE
ORBIT_INTERVAL_SECONDS=30
ORBIT_DISK_PATH=/
```

Registra cada servidor desde Orbit y usa el ID y el token que genera el alta. Guarda el archivo de entorno con permisos `0600`.

Arranca el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now orbit-server-agent
sudo systemctl status orbit-server-agent
```

Ver logs:

```bash
journalctl -u orbit-server-agent -f
```
