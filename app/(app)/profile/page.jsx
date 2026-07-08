'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { useToast } from '@/components/ui/toaster'
import { useAppData } from '@/lib/data-context'
import { formatDate, relativeTime } from '@/lib/format'
import { Mail, Phone, MapPin, Briefcase, Award, Clock } from 'lucide-react'

export default function ProfilePage() {
  const { toast } = useToast()
  const data = useAppData()
  const currentUser = data.currentUser || { name: 'Usuario', email: '', skills: [] }
  const { tasks, projects, activity, updateCurrentMember } = data
  const [name, setName] = useState(currentUser.name)
  const [email, setEmail] = useState(currentUser.email)
  const [bio, setBio] = useState(currentUser.bio || '')

  useEffect(() => {
    setName(currentUser.name || '')
    setEmail(currentUser.email || '')
    setBio(currentUser.bio || '')
  }, [currentUser.bio, currentUser.email, currentUser.name])

  const myTasks = tasks.filter((t) => t.assigneeId === currentUser.id)
  const openTasks = myTasks.filter((t) => t.status !== 'done')
  const myProjects = projects.filter(
    (p) => p.leadId === currentUser.id || (p.memberIds || []).includes(currentUser.id),
  )
  const myActivity = activity.filter((a) => a.actorId === currentUser.id).slice(0, 6)

  async function save(e) {
    e.preventDefault()
    try {
      await updateCurrentMember({ name, email, bio })
      toast({ title: 'Perfil actualizado', description: 'Tus cambios se han guardado correctamente.' })
    } catch (err) {
      toast({ title: 'No se pudo guardar', description: err.message || 'Revisa la conexion con Supabase.', tone: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" description="Gestiona tu información personal y revisa tu actividad." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: identity card */}
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center pt-6 text-center">
              <Avatar
                name={currentUser.name}
                src={currentUser.avatar}
                color={currentUser.color}
                size="xl"
              />
              <h2 className="mt-4 text-lg font-semibold text-foreground">{currentUser.name}</h2>
              <p className="text-sm text-muted-foreground">{currentUser.role || 'Cuenta'}</p>
              <div className="mt-3">
                <StatusBadge type="availability" value={currentUser.availability || 'available'} dot />
              </div>

              <div className="mt-6 w-full space-y-3 text-left text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{currentUser.phone || 'Sin telefono'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{currentUser.location || 'Sin ubicacion'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Miembro desde {formatDate(currentUser.joined || currentUser.joinedAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Habilidades</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(currentUser.skills || []).map(
                (s) => (
                  <Badge key={s} tone="muted">
                    {s}
                  </Badge>
                ),
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: stats + edit + activity */}
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Proyectos', value: myProjects.length, icon: Briefcase },
              { label: 'Tareas abiertas', value: openTasks.length, icon: Clock },
              { label: 'Completadas', value: myTasks.length - openTasks.length, icon: Award },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="flex flex-col items-center gap-1 pt-6 text-center">
                  <s.icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold text-foreground">{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Editar información</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-name">Nombre completo</Label>
                    <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-email">Correo electrónico</Label>
                    <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-bio">Biografía</Label>
                  <Textarea id="p-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Guardar cambios</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {myActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
              ) : (
                <ul className="space-y-4">
                  {myActivity.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{(currentUser.name || 'Usuario').split(' ')[0]}</span> {a.text}
                        </p>
                        {a.detail && <p className="text-xs text-muted-foreground">{a.detail}</p>}
                        <p className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
