'use client'

import { useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toaster'
import { useAppData } from '@/lib/data-context'
import { CLIENT_STATUS } from '@/lib/constants'

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

export function CreateClientModal({ open, onClose }) {
  const { toast } = useToast()
  const { createClient, salesReps } = useAppData()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    salesRepId: '',
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
      setForm((prev) => ({ ...prev, name: '', legalName: '', taxId: '', contact: '', email: '', phone: '', address: '', salesRepId: '' }))
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
          <Label htmlFor="new-client-sales-rep">Comercial asignado</Label>
          <Select id="new-client-sales-rep" className="mt-1.5" value={form.salesRepId} onChange={(e) => set('salesRepId', e.target.value)}>
            <option value="">Sin comercial</option>
            {salesReps.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
          </Select>
        </div>
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
    const command = `POCKETBASE_URL="${process.env.NEXT_PUBLIC_POCKETBASE_URL || '<POCKETBASE_URL>'}" ORBIT_SERVER_ID="${created.server.id}" ORBIT_SERVER_TOKEN="${created.token}" bash orbit-server-agent.sh`
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
            <p className="mt-1 text-muted-foreground">PocketBase solo almacena el hash; no podras verlo de nuevo.</p>
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
