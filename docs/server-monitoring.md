# Monitorizacion de servidores

Orbit monitoriza servidores con un agente ligero instalado en cada VPS.

## Que mide

- CPU: calculada desde `/proc/stat`.
- RAM: calculada desde `MemTotal` y `MemAvailable`.
- SSD/disco: porcentaje de uso de `df` sobre `ORBIT_DISK_PATH`, por defecto `/`.
- Online/offline: cada reporte actualiza `last_check`; la app marca offline si no hay reporte en 3 minutos.
- Historial: cada reporte crea una fila en `server_metrics`.

## Configuracion en Supabase

Ejecuta de nuevo `supabase/schema.sql` en el SQL editor. Es idempotente y anade:

- `servers.agent_token_hash`
- `server_metrics`
- `report_server_metrics(...)`
- `create_monitored_server(...)`

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
SUPABASE_URL=https://orbit.messigualada.com
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzNTA3NjAyLCJleHAiOjE5NDExODc2MDJ9.FZyYSubc5JPZyc2xm-hj-2YjZZtmis83lCzd_G47QGI
ORBIT_SERVER_ID=ec284838-04cb-4253-aacf-efd0b05a02de
ORBIT_SERVER_TOKEN=a0789a29127fad4067078f2bd140e790cfe40f2c8c2d84a7
ORBIT_INTERVAL_SECONDS=30
ORBIT_DISK_PATH=/
```

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
