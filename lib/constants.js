import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Calendar,
  Users,
  Building2,
  CreditCard,
  KeyRound,
  GitBranch,
  Server,
  CheckSquare,
  Bell,
  Settings,
} from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Proyectos', href: '/projects', icon: FolderKanban },
  { label: 'Tareas', href: '/tasks', icon: ListChecks },
  { label: 'Calendario', href: '/calendar', icon: Calendar },
  { label: 'Equipo', href: '/team', icon: Users },
  { label: 'Clientes', href: '/clients', icon: Building2 },
  { label: 'Facturacion', href: '/billing', icon: CreditCard },
  { label: 'Credenciales', href: '/credentials', icon: KeyRound },
  { label: 'GitHub', href: '/github', icon: GitBranch },
  { label: 'Servidores', href: '/servers', icon: Server },
  { label: 'To-do lists', href: '/todos', icon: CheckSquare },
  { label: 'Notificaciones', href: '/notifications', icon: Bell },
  { label: 'Ajustes', href: '/settings', icon: Settings },
]

export const PROJECT_STATUS = {
  idea: { label: 'Idea', tone: 'muted' },
  planning: { label: 'Planificacion', tone: 'info' },
  development: { label: 'En desarrollo', tone: 'primary' },
  review: { label: 'En revision', tone: 'warning' },
  blocked: { label: 'Bloqueado', tone: 'destructive' },
  production: { label: 'En produccion', tone: 'success' },
  maintenance: { label: 'Mantenimiento', tone: 'purple' },
  completed: { label: 'Completado', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: 'muted' },
}

export const PRIORITY = {
  low: { label: 'Baja', tone: 'muted' },
  medium: { label: 'Media', tone: 'info' },
  high: { label: 'Alta', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'destructive' },
}

export const TASK_STATUS = {
  todo: { label: 'Pendiente', tone: 'muted' },
  in_progress: { label: 'En progreso', tone: 'info' },
  review: { label: 'En revision', tone: 'warning' },
  blocked: { label: 'Bloqueada', tone: 'destructive' },
  done: { label: 'Completada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'muted' },
}

export const TASK_COLUMNS = ['todo', 'in_progress', 'review', 'blocked', 'done']

export const MEETING_STATUS = {
  scheduled: { label: 'Programada', tone: 'info' },
  in_progress: { label: 'En curso', tone: 'warning' },
  completed: { label: 'Completada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'muted' },
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

export const AVAILABILITY = {
  available: { label: 'Disponible', tone: 'success' },
  busy: { label: 'Ocupado', tone: 'info' },
  overloaded: { label: 'Saturado', tone: 'warning' },
  vacation: { label: 'De vacaciones', tone: 'purple' },
  away: { label: 'Ausente', tone: 'muted' },
}

export const PR_STATUS = {
  open: { label: 'Abierta', tone: 'success' },
  review: { label: 'En revision', tone: 'info' },
  merged: { label: 'Fusionada', tone: 'purple' },
  closed: { label: 'Cerrada', tone: 'muted' },
  draft: { label: 'Borrador', tone: 'muted' },
}

export const CALENDAR_EVENT_TYPES = {
  meeting: { label: 'Reunion', tone: 'purple' },
  milestone: { label: 'Hito', tone: 'primary' },
  deadline: { label: 'Fecha limite', tone: 'destructive' },
  delivery: { label: 'Entrega', tone: 'info' },
  billing: { label: 'Facturacion', tone: 'success' },
  vacation: { label: 'Vacaciones', tone: 'warning' },
}
