'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'

const preferences = [
  ['email','Notificaciones por email'], ['push','Notificaciones push'], ['servers','Alertas de servidores'],
  ['billing','Facturacion'], ['weekly','Resumen semanal'],
]

export default function SettingsPage() {
  const { currentUser, organization, preferences: savedPreferences, integrations, updateOrganization, savePreferences, setIntegrationConnected } = useAppData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const isAdmin = currentUser?.role === 'admin'
  async function save(event, kind) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      if (kind === 'organization') await updateOrganization(Object.fromEntries(form))
      else await savePreferences(Object.fromEntries(preferences.map(([key]) => [key, form.has(key)])))
      toast({ title: 'Cambios guardados' })
    } catch (error) { toast({ title: 'No se pudo guardar', description: error.message, tone: 'error' }) }
    finally { setBusy(false) }
  }
  async function toggleIntegration(integration) {
    setBusy(true)
    try {
      await setIntegrationConnected(integration.id, !integration.connected)
      toast({ title: 'Integracion actualizada' })
    } catch (error) { toast({ title: 'No se pudo guardar', description: error.message, tone: 'error' }) }
    finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Ajustes" description="Cuenta, workspace y preferencias" />
      <Card><CardHeader><CardTitle>Cuenta</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-4"><div><p className="font-medium">{currentUser?.name}</p><p className="text-sm text-muted-foreground">{currentUser?.email}</p></div><Link href="/profile" className="text-sm text-primary hover:underline">Editar perfil</Link></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Datos del workspace</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(event) => save(event, 'organization')} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="studio">Nombre</Label><Input id="studio" name="name" defaultValue={organization.name} required disabled={!isAdmin || busy} /></div>
              <div className="space-y-1.5"><Label htmlFor="cif">CIF</Label><Input id="cif" name="cif" defaultValue={organization.cif} disabled={!isAdmin || busy} /></div>
              <div className="space-y-1.5"><Label htmlFor="currency">Moneda</Label><Input id="currency" name="currency" defaultValue={organization.currency || 'EUR'} disabled={!isAdmin || busy} /></div>
              <p className="text-sm text-muted-foreground">Plan {organization.plan || 'Business'}</p>
              {isAdmin && <Button type="submit" disabled={busy}>Guardar cambios</Button>}
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Preferencias de notificacion</CardTitle></CardHeader>
          <CardContent>
            <form key={savedPreferences?.id || 'new'} onSubmit={(event) => save(event, 'preferences')} className="space-y-4">
              {preferences.map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 text-sm"><span>{label}</span><input name={key} type="checkbox" defaultChecked={savedPreferences?.notifications?.[key] ?? ['email','servers'].includes(key)} className="h-4 w-4 accent-primary" disabled={busy} /></label>)}
              <Button type="submit" disabled={busy}>Guardar preferencias</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card><CardHeader><CardTitle>Apariencia</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><span className="text-sm">Tema</span><ThemeToggle /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Integraciones</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {integrations.length === 0 && <p className="text-sm text-muted-foreground">Sin integraciones configuradas.</p>}
          {integrations.map((integration) => <div key={integration.id} className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">{integration.name}</p><p className="text-xs text-muted-foreground">{integration.desc}</p></div><Button variant="outline" disabled={!isAdmin || busy} onClick={() => toggleIntegration(integration)}>{integration.connected ? 'Activa' : 'Inactiva'}</Button></div>)}
        </CardContent>
      </Card>
    </div>
  )
}
