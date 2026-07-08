'use client'

import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Copy, FolderPlus, Loader2, Server, UserPlus, UsersRound } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toaster'
import { useAppData } from '@/lib/data-context'
import { AVAILABILITY, CLIENT_STATUS, PRIORITY, PROJECT_STATUS, TASK_STATUS } from '@/lib/constants'

const COLORS = [
  'oklch(0.54 0.21 268)',
  'oklch(0.6 0.16 240)',
  'oklch(0.62 0.16 150)',
  'oklch(0.65 0.22 300)',
  'oklch(0.78 0.15 75)',
  'oklch(0.58 0.22 27)',
]

function splitList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function generateAgentToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : ''
}

function useGithubRepositoryOptions(enabled) {
  const [state, setState] = useState({ repos: [], loading: false, error: '' })

  useEffect(() => {
    if (!enabled) return
    let ignore = false

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const response = await fetch('/api/github', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los repositorios.')
        const repos = (payload.repositories || []).slice().sort((a, b) => a.name.localeCompare(b.name))
        if (!ignore) setState({ repos, loading: false, error: '' })
      } catch (err) {
        if (!ignore) setState({ repos: [], loading: false, error: err.message })
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [enabled])

  return state
}

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

function ModalFooter({ busy, onClose, submitLabel }) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
        Cancelar
      </Button>
      <Button type="submit" form="create-entity-form" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </>
  )
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full border-2 ${value === color ? 'border-foreground' : 'border-transparent'}`}
          style={{ background: color }}
          aria-label="Seleccionar color"
        />
      ))}
    </div>
  )
}

function MemberChecks({ members, selected, onChange, label = 'Equipo' }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  return (
    <Field label={label}>
      <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-2 sm:grid-cols-2">
        {members.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">No hay miembros disponibles.</p>
        ) : (
          members.map((member) => (
            <label key={member.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.includes(member.id)}
                onChange={() => toggle(member.id)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="truncate">{member.name}</span>
            </label>
          ))
        )}
      </div>
    </Field>
  )
}

export function CreateClientModal({ open, onClose }) {
  const { toast } = useToast()
  const { createClient } = useAppData()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    taxId: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    status: 'lead',
    type: 'Empresa',
    color: COLORS[0],
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    try {
      await createClient({ ...form, name: form.name.trim() })
      toast({ title: 'Cliente creado', description: form.name })
      onClose()
      setForm((prev) => ({ ...prev, name: '', legalName: '', taxId: '', contact: '', email: '', phone: '', address: '' }))
    } catch (err) {
      toast({ title: 'No se pudo crear el cliente', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo cliente"
      description="Registra una empresa o lead para asociarla a proyectos, facturas y reuniones."
      size="lg"
      footer={<ModalFooter busy={busy} onClose={onClose} submitLabel="Crear cliente" />}
    >
      <form id="create-entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre comercial" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Tipo">
          <Input value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="Empresa, Startup..." />
        </Field>
        <Field label="Razon social">
          <Input value={form.legalName} onChange={(e) => set('legalName', e.target.value)} />
        </Field>
        <Field label="NIF/CIF">
          <Input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} />
        </Field>
        <Field label="Persona de contacto">
          <Input value={form.contact} onChange={(e) => set('contact', e.target.value)} />
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(CLIENT_STATUS).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Telefono">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Direccion">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Color">
            <ColorPicker value={form.color} onChange={(value) => set('color', value)} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

export function CreateMemberModal({ open, onClose }) {
  const { toast } = useToast()
  const { createMember } = useAppData()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    title: '',
    role: '',
    phone: '',
    availability: 'available',
    capacity: 40,
    skills: '',
    joined: '',
    color: COLORS[1],
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setBusy(true)
    try {
      await createMember({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        skills: splitList(form.skills),
      })
      toast({ title: 'Miembro creado', description: form.name })
      onClose()
      setForm((prev) => ({ ...prev, name: '', email: '', title: '', role: '', phone: '', skills: '', joined: '' }))
    } catch (err) {
      toast({ title: 'No se pudo crear el miembro', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo miembro"
      description="Anade personal al equipo para asignarlo a proyectos y tareas."
      size="lg"
      footer={<ModalFooter busy={busy} onClose={onClose} submitLabel="Crear miembro" />}
    >
      <form id="create-entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Cargo">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Rol">
          <Input value={form.role} onChange={(e) => set('role', e.target.value)} />
        </Field>
        <Field label="Telefono">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Disponibilidad">
          <Select value={form.availability} onChange={(e) => set('availability', e.target.value)}>
            {Object.entries(AVAILABILITY).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Capacidad semanal">
          <Input type="number" min="0" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </Field>
        <Field label="Fecha de incorporacion">
          <Input type="date" value={form.joined} onChange={(e) => set('joined', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Habilidades">
            <Input value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="React, PostgreSQL, Ventas" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Color">
            <ColorPicker value={form.color} onChange={(value) => set('color', value)} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

export function CreateProjectModal({ open, onClose }) {
  const { toast } = useToast()
  const { clients, team, createProject } = useAppData()
  const githubRepos = useGithubRepositoryOptions(open)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    description: '',
    status: 'idea',
    priority: 'medium',
    progress: 0,
    leadId: '',
    memberIds: [],
    startDate: '',
    dueDate: '',
    budget: '',
    estimatedHours: '',
    risk: 'low',
    tech: '',
    supabaseDashboardUrl: '',
    publicUrl: '',
    githubRepoFullName: '',
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    try {
      await createProject({
        ...form,
        name: form.name.trim(),
        tech: splitList(form.tech),
        memberIds: form.memberIds,
      })
      toast({ title: 'Proyecto creado', description: form.name })
      onClose()
      setForm((prev) => ({
        ...prev,
        name: '',
        description: '',
        tech: '',
        supabaseDashboardUrl: '',
        publicUrl: '',
        githubRepoFullName: '',
        budget: '',
        estimatedHours: '',
        progress: 0,
        memberIds: [],
      }))
    } catch (err) {
      toast({ title: 'No se pudo crear el proyecto', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo proyecto"
      description="Crea el proyecto y deja definidos cliente, responsable, equipo y plan inicial."
      size="xl"
      footer={<ModalFooter busy={busy} onClose={onClose} submitLabel="Crear proyecto" />}
    >
      <form id="create-entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Cliente">
          <Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Sin cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(PROJECT_STATUS).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridad">
          <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(PRIORITY).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable">
          <Select value={form.leadId} onChange={(e) => set('leadId', e.target.value)}>
            <option value="">Sin responsable</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Riesgo">
          <Select value={form.risk} onChange={(e) => set('risk', e.target.value)}>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
          </Select>
        </Field>
        <Field label="Inicio">
          <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Entrega">
          <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Presupuesto">
          <Input type="number" min="0" value={form.budget} onChange={(e) => set('budget', e.target.value)} />
        </Field>
        <Field label="Horas estimadas">
          <Input type="number" min="0" value={form.estimatedHours} onChange={(e) => set('estimatedHours', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripcion">
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Tecnologias">
            <Input value={form.tech} onChange={(e) => set('tech', e.target.value)} placeholder="Next.js, Supabase, Stripe" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Repositorio GitHub">
            <Select value={form.githubRepoFullName} onChange={(e) => set('githubRepoFullName', e.target.value)} disabled={githubRepos.loading}>
              <option value="">{githubRepos.loading ? 'Cargando repositorios...' : 'Sin repositorio'}</option>
              {githubRepos.repos.map((repo) => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </Select>
            {githubRepos.error && <p className="text-xs text-muted-foreground">{githubRepos.error}</p>}
          </Field>
        </div>
        <Field label="Supabase dashboard">
          <Input type="url" value={form.supabaseDashboardUrl} onChange={(e) => set('supabaseDashboardUrl', e.target.value)} placeholder="https://supabase.com/dashboard/project/..." />
        </Field>
        <Field label="Web publica">
          <Input type="url" value={form.publicUrl} onChange={(e) => set('publicUrl', e.target.value)} placeholder="https://app.ejemplo.com" />
        </Field>
        <div className="sm:col-span-2">
          <MemberChecks members={team} selected={form.memberIds} onChange={(value) => set('memberIds', value)} />
        </div>
      </form>
    </Modal>
  )
}

export function EditProjectModal({ project, open, onClose }) {
  const { toast } = useToast()
  const { clients, team, updateProject } = useAppData()
  const githubRepos = useGithubRepositoryOptions(open)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    description: '',
    status: 'idea',
    priority: 'medium',
    progress: 0,
    leadId: '',
    memberIds: [],
    startDate: '',
    dueDate: '',
    budget: '',
    estimatedHours: '',
    loggedHours: '',
    risk: 'low',
    tech: '',
    supabaseDashboardUrl: '',
    publicUrl: '',
    githubRepoFullName: '',
  })

  useEffect(() => {
    if (!project || !open) return
    setForm({
      name: project.name || '',
      clientId: project.clientId || '',
      description: project.description || '',
      status: project.status || 'idea',
      priority: project.priority || 'medium',
      progress: project.progress ?? 0,
      leadId: project.leadId || '',
      memberIds: project.memberIds || [],
      startDate: toDateInput(project.startDate),
      dueDate: toDateInput(project.dueDate),
      budget: project.budget ?? '',
      estimatedHours: project.estimatedHours ?? '',
      loggedHours: project.loggedHours ?? '',
      risk: project.risk || 'low',
      tech: (project.tech || []).join(', '),
      supabaseDashboardUrl: project.supabaseDashboardUrl || '',
      publicUrl: project.publicUrl || '',
      githubRepoFullName: project.githubRepoFullName || '',
    })
  }, [open, project])

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!project?.id || !form.name.trim()) return
    setBusy(true)
    try {
      await updateProject(project.id, {
        ...form,
        name: form.name.trim(),
        tech: splitList(form.tech),
        memberIds: form.memberIds,
      })
      toast({ title: 'Proyecto actualizado', description: form.name })
      onClose()
    } catch (err) {
      toast({ title: 'No se pudo actualizar el proyecto', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar proyecto"
      description="Actualiza cliente, responsable, estado, fechas, presupuesto y equipo asignado."
      size="xl"
      footer={<ModalFooter busy={busy} onClose={onClose} submitLabel="Guardar cambios" />}
    >
      <form id="create-entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Cliente">
          <Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Sin cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(PROJECT_STATUS).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridad">
          <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(PRIORITY).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable">
          <Select value={form.leadId} onChange={(e) => set('leadId', e.target.value)}>
            <option value="">Sin responsable</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Riesgo">
          <Select value={form.risk} onChange={(e) => set('risk', e.target.value)}>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
          </Select>
        </Field>
        <Field label="Inicio">
          <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Entrega">
          <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Progreso">
          <Input type="number" min="0" max="100" value={form.progress} onChange={(e) => set('progress', e.target.value)} />
        </Field>
        <Field label="Presupuesto">
          <Input type="number" min="0" value={form.budget} onChange={(e) => set('budget', e.target.value)} />
        </Field>
        <Field label="Horas estimadas">
          <Input type="number" min="0" value={form.estimatedHours} onChange={(e) => set('estimatedHours', e.target.value)} />
        </Field>
        <Field label="Horas registradas">
          <Input type="number" min="0" value={form.loggedHours} onChange={(e) => set('loggedHours', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripcion">
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Tecnologias">
            <Input value={form.tech} onChange={(e) => set('tech', e.target.value)} placeholder="Next.js, Supabase, Stripe" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Repositorio GitHub">
            <Select value={form.githubRepoFullName} onChange={(e) => set('githubRepoFullName', e.target.value)} disabled={githubRepos.loading}>
              <option value="">{githubRepos.loading ? 'Cargando repositorios...' : 'Sin repositorio'}</option>
              {form.githubRepoFullName && !githubRepos.repos.some((repo) => repo.name === form.githubRepoFullName) && (
                <option value={form.githubRepoFullName}>{form.githubRepoFullName}</option>
              )}
              {githubRepos.repos.map((repo) => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </Select>
            {githubRepos.error && <p className="text-xs text-muted-foreground">{githubRepos.error}</p>}
          </Field>
        </div>
        <Field label="Supabase dashboard">
          <Input type="url" value={form.supabaseDashboardUrl} onChange={(e) => set('supabaseDashboardUrl', e.target.value)} placeholder="https://supabase.com/dashboard/project/..." />
        </Field>
        <Field label="Web publica">
          <Input type="url" value={form.publicUrl} onChange={(e) => set('publicUrl', e.target.value)} placeholder="https://app.ejemplo.com" />
        </Field>
        <div className="sm:col-span-2">
          <MemberChecks members={team} selected={form.memberIds} onChange={(value) => set('memberIds', value)} />
        </div>
      </form>
    </Modal>
  )
}

export function CreateTaskModal({ open, onClose }) {
  const { toast } = useToast()
  const { projects, team, createTask } = useAppData()
  const [busy, setBusy] = useState(false)
  const defaultProject = useMemo(() => projects[0]?.id || '', [projects])
  const [form, setForm] = useState({
    title: '',
    projectId: '',
    assigneeId: '',
    collaborators: [],
    status: 'todo',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    estimate: '',
    tags: '',
    repoIssue: '',
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    try {
      await createTask({
        ...form,
        projectId: form.projectId || defaultProject || null,
        title: form.title.trim(),
        tags: splitList(form.tags),
      })
      toast({ title: 'Tarea creada', description: form.title })
      onClose()
      setForm((prev) => ({ ...prev, title: '', collaborators: [], estimate: '', tags: '', repoIssue: '' }))
    } catch (err) {
      toast({ title: 'No se pudo crear la tarea', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva tarea"
      description="Anade una tarea al tablero con responsable, fechas y etiquetas."
      size="lg"
      footer={<ModalFooter busy={busy} onClose={onClose} submitLabel="Crear tarea" />}
    >
      <form id="create-entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Titulo" required>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          </Field>
        </div>
        <Field label="Proyecto">
          <Select value={form.projectId || defaultProject} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable">
          <Select value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            <option value="">Sin responsable</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(TASK_STATUS).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridad">
          <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(PRIORITY).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Inicio">
          <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Entrega">
          <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Estimacion">
          <Input type="number" min="0" value={form.estimate} onChange={(e) => set('estimate', e.target.value)} />
        </Field>
        <Field label="Issue">
          <Input value={form.repoIssue} onChange={(e) => set('repoIssue', e.target.value)} placeholder="#123" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Etiquetas">
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="frontend, urgente, qa" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <MemberChecks members={team} selected={form.collaborators} onChange={(value) => set('collaborators', value)} label="Colaboradores" />
        </div>
      </form>
    </Modal>
  )
}

export function CreateServerModal({ open, onClose }) {
  const { toast } = useToast()
  const { createServer } = useAppData()
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)
  const [form, setForm] = useState({
    name: '',
    provider: '',
    ip: '',
    location: '',
    os: '',
    domains: '',
    services: '',
    agentToken: generateAgentToken(),
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function reset() {
    setCreated(null)
    setForm({
      name: '',
      provider: '',
      ip: '',
      location: '',
      os: '',
      domains: '',
      services: '',
      agentToken: generateAgentToken(),
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    try {
      const server = await createServer({
        ...form,
        name: form.name.trim(),
        domains: splitList(form.domains),
        services: splitList(form.services),
      })
      setCreated({ server, token: form.agentToken })
      toast({ title: 'Servidor creado', description: form.name })
    } catch (err) {
      toast({ title: 'No se pudo crear el servidor', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  function close() {
    reset()
    onClose()
  }

  async function copyInstallCommand() {
    const command = `SUPABASE_URL=\"${process.env.NEXT_PUBLIC_SUPABASE_URL || '<SUPABASE_URL>'}\" SUPABASE_ANON_KEY=\"${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '<SUPABASE_ANON_KEY>'}\" ORBIT_SERVER_ID=\"${created.server.id}\" ORBIT_SERVER_TOKEN=\"${created.token}\" bash orbit-server-agent.sh`
    await navigator.clipboard?.writeText(command)
    toast({ title: 'Comando copiado', description: 'Usalo en el servidor junto al script del agente.' })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Nuevo servidor"
      description="Registra un VPS y genera el token privado que usara el agente de monitorizacion."
      size="lg"
      footer={
        created ? (
          <Button type="button" onClick={close}>Cerrar</Button>
        ) : (
          <ModalFooter busy={busy} onClose={close} submitLabel="Crear servidor" />
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
            <p className="font-medium text-foreground">Guarda este token ahora.</p>
            <p className="mt-1 text-muted-foreground">Supabase solo almacena el hash; no podras verlo de nuevo.</p>
          </div>
          <Field label="Server ID">
            <Input value={created.server.id} readOnly className="font-mono" />
          </Field>
          <Field label="Agent token">
            <Input value={created.token} readOnly className="font-mono" />
          </Field>
          <Button type="button" variant="outline" onClick={copyInstallCommand}>
            <Copy className="h-4 w-4" />
            Copiar comando base
          </Button>
        </div>
      ) : (
        <form id="create-entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="web-prod-01" />
          </Field>
          <Field label="Proveedor">
            <Input value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Hetzner, AWS, DigitalOcean" />
          </Field>
          <Field label="IP">
            <Input value={form.ip} onChange={(e) => set('ip', e.target.value)} placeholder="203.0.113.10" />
          </Field>
          <Field label="Ubicacion">
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Madrid, ES" />
          </Field>
          <Field label="Sistema operativo">
            <Input value={form.os} onChange={(e) => set('os', e.target.value)} placeholder="Ubuntu 24.04 LTS" />
          </Field>
          <Field label="Servicios">
            <Input value={form.services} onChange={(e) => set('services', e.target.value)} placeholder="nginx, node, postgres" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dominios">
              <Input value={form.domains} onChange={(e) => set('domains', e.target.value)} placeholder="app.ejemplo.com, api.ejemplo.com" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Token del agente">
              <div className="flex gap-2">
                <Input value={form.agentToken} onChange={(e) => set('agentToken', e.target.value)} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => set('agentToken', generateAgentToken())}>
                  Regenerar
                </Button>
              </div>
            </Field>
          </div>
        </form>
      )}
    </Modal>
  )
}

export const CREATE_ENTITY_ICONS = {
  client: BriefcaseBusiness,
  member: UserPlus,
  project: FolderPlus,
  task: UsersRound,
  server: Server,
}
