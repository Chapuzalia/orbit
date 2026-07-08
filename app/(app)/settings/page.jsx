'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'
import { User, Building2, Bell, Palette, Plug, Check } from 'lucide-react'

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function Row({ title, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { currentUser: loadedUser, organization, integrations: dbIntegrations } = useAppData()
  const currentUser = loadedUser || { name: 'Usuario', email: '', role: 'Cuenta' }
  const [tab, setTab] = useState('profile')
  const [notif, setNotif] = useState({ email: true, push: true, servers: true, billing: false, weekly: true })
  const [integrations, setIntegrations] = useState(dbIntegrations)

  useEffect(() => {
    setIntegrations(dbIntegrations)
  }, [dbIntegrations])

  const save = () => toast({ title: 'Guardado', description: 'Los cambios se han guardado correctamente.' })

  return (
    <div className="space-y-6">
      <PageHeader title="Ajustes" description="Gestiona tu cuenta, el estudio y las preferencias" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="studio">
            <Building2 className="h-4 w-4" />
            Estudio
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4" />
            Apariencia
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="h-4 w-4" />
            Integraciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Información personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar name={currentUser.name} color={currentUser.color} size="lg" />
                <Button variant="outline" onClick={() => toast({ title: 'Foto', description: 'Subida de imagen pendiente de implementar.' })}>
                  Cambiar foto
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" defaultValue={currentUser.name} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={currentUser.email} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Rol</Label>
                  <Input id="role" defaultValue={currentUser.role} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" defaultValue={currentUser.phone || ''} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" rows={3} defaultValue={currentUser.bio || ''} />
              </div>
              <div className="flex justify-end">
                <Button onClick={save}>Guardar cambios</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="studio">
          <Card>
            <CardHeader>
              <CardTitle>Datos del estudio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="studio">Nombre del estudio</Label>
                  <Input id="studio" defaultValue={organization.name} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cif">CIF</Label>
                  <Input id="cif" defaultValue={organization.cif || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan">Plan</Label>
                  <Input id="plan" defaultValue={organization.plan} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Moneda</Label>
                  <Input id="currency" defaultValue={organization.currency || 'EUR'} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={save}>Guardar cambios</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de notificación</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <Row title="Notificaciones por email" description="Recibe un resumen en tu correo">
                <Toggle checked={notif.email} onChange={(v) => setNotif({ ...notif, email: v })} label="Email" />
              </Row>
              <Row title="Notificaciones push" description="Alertas en el navegador">
                <Toggle checked={notif.push} onChange={(v) => setNotif({ ...notif, push: v })} label="Push" />
              </Row>
              <Row title="Alertas de servidores" description="Avisos de CPU, RAM y caídas">
                <Toggle checked={notif.servers} onChange={(v) => setNotif({ ...notif, servers: v })} label="Servidores" />
              </Row>
              <Row title="Facturación" description="Facturas emitidas, pagadas y vencidas">
                <Toggle checked={notif.billing} onChange={(v) => setNotif({ ...notif, billing: v })} label="Facturación" />
              </Row>
              <Row title="Resumen semanal" description="Cada lunes por la mañana">
                <Toggle checked={notif.weekly} onChange={(v) => setNotif({ ...notif, weekly: v })} label="Resumen semanal" />
              </Row>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Apariencia</CardTitle>
            </CardHeader>
            <CardContent>
              <Row title="Tema" description="Cambia entre modo claro y oscuro">
                <ThemeToggle />
              </Row>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integraciones</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {integrations.map((int, i) => (
                <Row key={int.name} title={int.name} description={int.desc}>
                  <Button
                    variant={int.connected ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => {
                      setIntegrations((prev) => prev.map((x, xi) => (xi === i ? { ...x, connected: !x.connected } : x)))
                      toast({
                        title: int.connected ? 'Desconectado' : 'Conectado',
                        description: `${int.name} ${int.connected ? 'se ha desconectado' : 'se ha conectado'}.`,
                      })
                    }}
                  >
                    {int.connected && <Check className="h-4 w-4" />}
                    {int.connected ? 'Conectado' : 'Conectar'}
                  </Button>
                </Row>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
