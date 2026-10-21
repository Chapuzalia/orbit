export const SERVER_METRIC_POINTS = 48

const timeFormat = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

export async function fetchServerMetricHistory(pb, serverId, { signal } = {}) {
  if (!serverId) return []

  // Limit in PocketBase: getFullList would paginate through the entire history.
  const { items } = await pb.collection('server_metrics').getList(1, SERVER_METRIC_POINTS, {
    filter: pb.filter('server_id = {:serverId}', { serverId }),
    sort: '-checked_at',
    fields: 'id,server_id,checked_at,cpu,ram,disk',
    skipTotal: true,
    requestKey: null,
    signal,
  })

  return items.reverse().map((row) => {
    const checkedAt = new Date(row.checked_at.replace(' ', 'T'))
    return {
      id: row.id,
      serverId: row.server_id,
      checkedAt: checkedAt.toISOString(),
      t: timeFormat.format(checkedAt),
      cpu: Number(row.cpu || 0),
      ram: Number(row.ram || 0),
      disk: Number(row.disk || 0),
    }
  })
}
