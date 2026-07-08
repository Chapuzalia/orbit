'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, GitBranch, Mail, ShieldCheck, Server } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Input, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { loginWithProvider, signIn } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase-client'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isSupabaseConfigured()) {
      setError('Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.')
      return
    }
    if (!email || !password) {
      setError('Introduce tu email y contrasena.')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion.')
      setLoading(false)
    }
  }

  const oauth = (provider) => {
    setError('')
    setLoading(true)
    try {
      loginWithProvider(provider)
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh bg-background">
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-8" textClassName="text-xl" />
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accede al panel de gestion interna de NorthStack Studio.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button variant="outline" className="w-full" onClick={() => oauth('google')} disabled={loading}>
              <GoogleIcon className="h-4 w-4" />
              Continuar con Google
            </Button>
            <Button variant="outline" className="w-full" onClick={() => oauth('github')} disabled={loading}>
              <GitBranch className="h-4 w-4" />
              Continuar con GitHub
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o con tu email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contrasena</Label>
                <button type="button" className="text-xs font-medium text-primary hover:underline">
                  Has olvidado tu contrasena?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="pr-9"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Recordarme en este dispositivo
            </label>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Iniciar sesion
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acceso gestionado con Supabase Auth.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:w-1/2">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.4) 0, transparent 45%)',
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <Logo textClassName="text-xl text-primary-foreground" className="[&_div]:bg-primary-foreground [&_div]:text-primary" />
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight text-balance">
              Toda tu consultora de software en un unico panel.
            </h2>
            <p className="mt-4 text-primary-foreground/80 text-pretty">
              Proyectos, repositorios, equipo, clientes, facturacion y servidores VPS conectados y
              en tiempo real.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Feature icon={GitBranch} text="Actividad de GitHub sincronizada con tus proyectos" />
              <Feature icon={Server} text="Monitorizacion de servidores VPS con alertas" />
              <Feature icon={ShieldCheck} text="Roles, permisos y seguridad por organizacion" />
            </div>
          </div>
          <p className="text-sm text-primary-foreground/70">NorthStack Studio - Panel interno</p>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <span className="text-sm text-primary-foreground/90">{text}</span>
    </div>
  )
}

function GoogleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}
