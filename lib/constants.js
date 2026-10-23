import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Building2,
  Users,
  CreditCard,
  Receipt,
  KeyRound,
  Server,
  Bell,
  Settings,
} from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Estadísticas', href: '/statistics', icon: ChartNoAxesCombined },
  { label: 'Clientes', href: '/clients', icon: Building2 },
  { label: 'Comerciales', href: '/sales-reps', icon: Users },
  { label: 'Facturacion', href: '/billing', icon: CreditCard },
  { label: 'Gastos', href: '/expenses', icon: Receipt },
  { label: 'Credenciales', href: '/credentials', icon: KeyRound },
  { label: 'Servidores', href: '/servers', icon: Server },
  { label: 'Notificaciones', href: '/notifications', icon: Bell },
  { label: 'Ajustes', href: '/settings', icon: Settings },
]

export const PRIORITY = {
  low: { label: 'Baja', tone: 'muted' },
  medium: { label: 'Media', tone: 'info' },
  high: { label: 'Alta', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'destructive' },
}


export const CLIENT_STATUS = {
  lead: { label: 'Lead', tone: 'muted' },
  contacted: { label: 'Contactado', tone: 'info' },
  proposal: { label: 'Propuesta enviada', tone: 'warning' },
  active: { label: 'Cliente activo', tone: 'success' },
  inactive: { label: 'Cliente inactivo', tone: 'muted' },
  lost: { label: 'Cliente perdido', tone: 'destructive' },
}

export const SERVER_STATUS = {
  operational: { label: 'Operativo', tone: 'success' },
  warning: { label: 'Advertencia', tone: 'warning' },
  critical: { label: 'Critico', tone: 'destructive' },
  offline: { label: 'Sin conexion', tone: 'muted' },
  maintenance: { label: 'Mantenimiento', tone: 'purple' },
}

export const INVOICE_STATUS = {
  draft: { label: 'Borrador', tone: 'muted' },
  sent: { label: 'Enviada', tone: 'info' },
  paid: { label: 'Pagada', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'warning' },
  overdue: { label: 'Vencida', tone: 'destructive' },
}
