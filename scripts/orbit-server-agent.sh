#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
: "${ORBIT_SERVER_ID:?ORBIT_SERVER_ID is required}"
: "${ORBIT_SERVER_TOKEN:?ORBIT_SERVER_TOKEN is required}"

INTERVAL_SECONDS="${ORBIT_INTERVAL_SECONDS:-60}"
DISK_PATH="${ORBIT_DISK_PATH:-/}"

read_cpu() {
  awk '/^cpu / { print $2, $3, $4, $5, $6, $7, $8 }' /proc/stat
}

cpu_percent() {
  local first second idle1 idle2 total1 total2 idle_delta total_delta
  first="$(read_cpu)"
  sleep 1
  second="$(read_cpu)"

  read -r u1 n1 s1 i1 w1 irq1 sirq1 <<< "$first"
  read -r u2 n2 s2 i2 w2 irq2 sirq2 <<< "$second"

  idle1=$((i1 + w1))
  idle2=$((i2 + w2))
  total1=$((u1 + n1 + s1 + i1 + w1 + irq1 + sirq1))
  total2=$((u2 + n2 + s2 + i2 + w2 + irq2 + sirq2))
  idle_delta=$((idle2 - idle1))
  total_delta=$((total2 - total1))

  if [ "$total_delta" -le 0 ]; then
    echo 0
  else
    echo $((100 * (total_delta - idle_delta) / total_delta))
  fi
}

ram_percent() {
  awk '
    /MemTotal:/ { total=$2 }
    /MemAvailable:/ { available=$2 }
    END {
      if (total > 0) printf "%d\n", (100 * (total - available) / total);
      else print 0;
    }
  ' /proc/meminfo
}

disk_percent() {
  df -P "$DISK_PATH" | awk 'NR==2 { gsub("%", "", $5); print $5 }'
}

load_average() {
  awk '{ print $1 }' /proc/loadavg
}

uptime_text() {
  uptime -p 2>/dev/null | sed 's/^up //' || true
}

report_once() {
  local cpu ram disk load uptime_payload started elapsed status http_code

  cpu="$(cpu_percent)"
  ram="$(ram_percent)"
  disk="$(disk_percent)"
  load="$(load_average)"
  uptime_payload="$(uptime_text)"
  status="operational"

  started="$(date +%s%3N)"
  http_code="$(
    curl -sS -o /tmp/orbit-agent-response.json -w '%{http_code}' \
      "${SUPABASE_URL%/}/rest/v1/rpc/report_server_metrics" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "$(printf '{"p_server_id":"%s","p_token":"%s","p_cpu":%s,"p_ram":%s,"p_disk":%s,"p_load":%s,"p_latency":0,"p_uptime":"%s","p_status":"%s"}' \
        "$ORBIT_SERVER_ID" \
        "$ORBIT_SERVER_TOKEN" \
        "$cpu" \
        "$ram" \
        "$disk" \
        "$load" \
        "$(printf '%s' "$uptime_payload" | sed 's/"/\\"/g')" \
        "$status")"
  )"
  elapsed="$(($(date +%s%3N) - started))"

  if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
    echo "Orbit agent report failed (${http_code}): $(cat /tmp/orbit-agent-response.json)" >&2
    return 1
  fi

  echo "reported cpu=${cpu}% ram=${ram}% disk=${disk}% load=${load} latency=${elapsed}ms"
}

while true; do
  report_once || true
  sleep "$INTERVAL_SECONDS"
done
