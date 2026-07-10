'use client'

import { useMemo, useState } from 'react'
import {
  Copy,
  Database,
  Eye,
  EyeOff,
  GitBranch,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toaster'
import { useAppData } from '@/lib/data-context'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'email', label: 'Correo', icon: Mail, tone: 'info' },
  { value: 'supabase', label: 'Supabase', icon: Database, tone: 'success' },
  { value: 'hosting', label: 'Hosting/VPS', icon: Server, tone: 'warning' },
  { value: 'github', label: 'GitHub', icon: GitBranch, tone: 'purple' },
  { value: 'domain', label: 'Dominios', icon: Globe2, tone: 'primary' },
  { value: 'database', label: 'Base de datos', icon: Database, tone: 'destructive' },
  { value: 'other', label: 'Otro', icon: KeyRound, tone: 'muted' },
]

const EMPTY_FORM = {
  id: '',
  name: '',
  category: 'email',
  site: '',
  username: '',
  email: '',
  password: '',
  recovery: '',
  notes: '',
}

function getCategory(value) {
  return CATEGORIES.find((category) => category.value === value) || CATEGORIES.at(-1)
}

function formatUpdated(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function CredentialsPage() {
  const { toast } = useToast()
  const { credentials, createCredential, updateCredential, deleteCredential } = useAppData()
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [visibleSecrets, setVisibleSecrets] = useState({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return credentials
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => {
        if (!term) return true
        return [item.name, item.site, item.username, item.email, item.notes]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  }, [category, credentials, query])

  const counts = useMemo(
    () =>
      CATEGORIES.reduce((acc, item) => {
        acc[item.value] = credentials.filter((credential) => credential.category === item.value).length
        return acc
      }, {}),
    [credentials],
  )

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
  }

  function editCredential(item) {
    setForm({
      id: item.id,
      name: item.name || '',
      category: item.category || 'other',
      site: item.site || '',
      username: item.username || '',
      email: item.email || '',
      password: item.password || '',
      recovery: item.recovery || '',
      notes: item.notes || '',
    })
  }

  async function saveCredential(event) {
    event.preventDefault()
    if (saving) return
    const name = form.name.trim()
    if (!name) {
      toast({ title: 'Falta el nombre', description: 'Asigna un nombre a la credencial.', tone: 'warning' })
      return
    }

    const payload = {
      name,
      category: form.category,
      site: form.site.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      recovery: form.recovery.trim(),
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      if (form.id) {
        await updateCredential(form.id, payload)
      } else {
        await createCredential(payload)
      }
      setForm(EMPTY_FORM)
      toast({ title: form.id ? 'Credencial actualizada' : 'Credencial guardada en Supabase', tone: 'success' })
    } catch (err) {
      toast({
        title: 'No se pudo guardar',
        description: err.message || 'Revisa la tabla credentials en Supabase.',
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function removeCredential(id) {
    if (deletingId) return
    setDeletingId(id)
    try {
      await deleteCredential(id)
      if (form.id === id) resetForm()
      toast({ title: 'Credencial eliminada', tone: 'info' })
    } catch (err) {
      toast({
        title: 'No se pudo eliminar',
        description: err.message || 'Intentalo de nuevo.',
        tone: 'error',
      })
    } finally {
      setDeletingId('')
    }
  }

  async function copyValue(label, value) {
    if (!value) return
    await navigator.clipboard?.writeText(value)
    toast({ title: `${label} copiado`, tone: 'success' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credenciales"
        description={`${credentials.length} cuentas compartidas en Supabase para servicios, correo y accesos tecnicos`}
        actions={
          <Button onClick={resetForm}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-semibold leading-none">{credentials.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Accesos totales</p>
            </div>
          </CardContent>
        </Card>
        {CATEGORIES.slice(0, 3).map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.value}>
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-semibold leading-none">{counts[item.value] || 0}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cuenta, sitio o usuario"
                className="pl-9"
              />
            </div>
            <Select value={category} onChange={(event) => setCategory(event.target.value)} className="sm:w-48">
              <option value="all">Todas</option>
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3">
            {filtered.map((item) => {
              const itemCategory = getCategory(item.category)
              const Icon = itemCategory.icon
              const secretVisible = visibleSecrets[item.id]
              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold">{item.name}</h2>
                            <p className="text-xs text-muted-foreground">Actualizado {formatUpdated(item.updatedAt)}</p>
                          </div>
                          <Badge tone={itemCategory.tone}>{itemCategory.label}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <CredentialField
                            icon={Globe2}
                            label="Sitio"
                            value={item.site}
                            onCopy={() => copyValue('Sitio', item.site)}
                          />
                          <CredentialField
                            icon={UserRound}
                            label="Usuario"
                            value={item.username || item.email}
                            onCopy={() => copyValue('Usuario', item.username || item.email)}
                          />
                          <CredentialField
                            icon={Mail}
                            label="Email"
                            value={item.email}
                            onCopy={() => copyValue('Email', item.email)}
                          />
                          <CredentialField
                            icon={KeyRound}
                            label="Contrasena"
                            value={item.password ? (secretVisible ? item.password : '************') : ''}
                            onCopy={() => copyValue('Contrasena', item.password)}
                            action={
                              item.password && (
                                <Button
                                  type="button"
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() =>
                                    setVisibleSecrets((current) => ({ ...current, [item.id]: !current[item.id] }))
                                  }
                                  aria-label={secretVisible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                                >
                                  {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                              )
                            }
                          />
                        </div>

                        {item.recovery && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            Recuperacion: <span className="text-foreground">{item.recovery}</span>
                          </p>
                        )}
                        {item.notes && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.notes}</p>}
                      </div>

                      <div className="flex shrink-0 gap-2 lg:flex-col">
                        <Button type="button" variant="outline" size="sm" onClick={() => editCredential(item)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeCredential(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          {deletingId === item.id ? 'Eliminando' : 'Eliminar'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {filtered.length === 0 && (
              <Card>
                <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
                  <KeyRound className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">No hay credenciales con esos filtros</p>
                  <p className="mt-1 text-sm text-muted-foreground">Cambia la busqueda o crea una nueva cuenta.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{form.id ? 'Editar credencial' : 'Nueva credencial'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveCredential} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="credential-name">Nombre</Label>
                <Input
                  id="credential-name"
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="Correo administracion"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credential-category">Tipo</Label>
                <Select
                  id="credential-category"
                  value={form.category}
                  onChange={(event) => updateForm('category', event.target.value)}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credential-site">Sitio o URL</Label>
                <Input
                  id="credential-site"
                  value={form.site}
                  onChange={(event) => updateForm('site', event.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-1.5">
                  <Label htmlFor="credential-user">Usuario</Label>
                  <Input
                    id="credential-user"
                    value={form.username}
                    onChange={(event) => updateForm('username', event.target.value)}
                    placeholder="usuario"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="credential-email">Email</Label>
                  <Input
                    id="credential-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    placeholder="cuenta@dominio.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credential-password">Contrasena</Label>
                <Input
                  id="credential-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm('password', event.target.value)}
                  placeholder="********"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credential-recovery">Recuperacion</Label>
                <Input
                  id="credential-recovery"
                  value={form.recovery}
                  onChange={(event) => updateForm('recovery', event.target.value)}
                  placeholder="Email, telefono o contacto"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="credential-notes">Notas</Label>
                <Textarea
                  id="credential-notes"
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  rows={4}
                  placeholder="2FA, owner, proyecto asociado..."
                />
              </div>

              <div className="flex justify-end gap-2">
                {form.id && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Guardando' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CredentialField({ icon: Icon, label, value, onCopy, action }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-secondary/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex min-h-7 items-center gap-2">
        <p className={cn('min-w-0 flex-1 truncate text-sm', !value && 'text-muted-foreground')}>{value || '-'}</p>
        {action}
        {value && onCopy && (
          <Button type="button" size="icon-xs" variant="ghost" onClick={onCopy} aria-label={`Copiar ${label}`}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
