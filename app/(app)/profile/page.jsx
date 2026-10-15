'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { useAppData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toaster'

export default function ProfilePage() {
  const { currentUser: user, updateCurrentUser } = useAppData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget))
      await updateCurrentUser(values)
      toast({ title: 'Perfil actualizado' })
    } catch (error) {
      toast({ title: 'No se pudo guardar', description: error.message, tone: 'error' })
    } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" description="Gestiona tu informacion personal" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <div className="mb-6 flex items-center gap-4"><Avatar name={user?.name} src={user?.avatar} size="lg" /><div><p className="font-semibold">{user?.name}</p><p className="text-sm text-muted-foreground">{user?.email}</p></div></div>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="name">Nombre</Label><Input id="name" name="name" defaultValue={user?.name} required /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={user?.email || ''} readOnly /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="phone">Telefono</Label><Input id="phone" name="phone" defaultValue={user?.phone} /></div>
              <div className="space-y-1.5"><Label htmlFor="location">Ubicacion</Label><Input id="location" name="location" defaultValue={user?.location} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="bio">Bio</Label><Textarea id="bio" name="bio" defaultValue={user?.bio} /></div>
            <Button type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar cambios'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
