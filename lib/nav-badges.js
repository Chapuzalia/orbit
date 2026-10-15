export function getNavBadge(item, data) {
  const {
    invoices = [],
    servers = [],
    notifications = [],
  } = data || {}

  switch (item.href) {
    case '/billing': {
      const value = invoices.filter((invoice) => ['pending', 'sent', 'overdue'].includes(invoice.status)).length
      return value > 0 ? { value, tone: 'warning' } : null
    }
    case '/servers': {
      const value = servers.filter((server) => ['warning', 'critical', 'offline'].includes(server.status)).length
      return value > 0 ? { value, tone: 'destructive' } : null
    }
    case '/notifications': {
      const value = notifications.filter((notification) => !notification.read).length
      return value > 0 ? { value } : null
    }
    default:
      return null
  }
}
