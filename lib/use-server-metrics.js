'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase-client'
import { fetchServerMetricHistory } from '@/lib/server-metrics.mjs'

export function useServerMetrics(serverId) {
  const [state, setState] = useState({ serverId: null, history: [], loading: false, error: '' })

  useEffect(() => {
    if (!serverId) return

    let active = true
    let timer
    const controller = new AbortController()
    setState({ serverId, history: [], loading: true, error: '' })

    async function refresh() {
      try {
        const history = await fetchServerMetricHistory(getPocketBase(), serverId, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        if (active) setState({ serverId, history, loading: false, error: '' })
      } catch {
        if (active) setState((prev) => ({ ...prev, loading: false, error: 'No se pudo cargar el historial. Se reintentara automaticamente.' }))
      } finally {
        // Schedule after completion so slow requests cannot overlap.
        if (active) timer = window.setTimeout(refresh, 30000)
      }
    }

    refresh()
    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [serverId])

  // A route change must never display the previous server's points.
  return serverId && state.serverId === serverId
    ? state
    : { history: [], loading: Boolean(serverId), error: '' }
}
