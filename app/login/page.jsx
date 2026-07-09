'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ArrowUpRight, Eye, EyeOff, Layers, Loader2, Mail, Server, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Input, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { signIn } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase-client'

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

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[0.92fr_1.08fr]">
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" markClassName="h-10 w-10 rounded-xl" textClassName="text-2xl" />
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase text-primary">Alteil Solutions</p>
            <h1 className="text-3xl font-semibold leading-tight text-balance">Bienvenido de nuevo</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Accede a Orbit, el panel operativo para coordinar proyectos, equipo y servidores.
            </p>
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

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Iniciar sesion
            </Button>
          </form>

          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            Orbit mantiene la sesion protegida y vinculada al workspace activo.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-[var(--brand-navy)] text-white lg:flex">
        <div className="absolute inset-y-0 left-0 w-px bg-white/10" aria-hidden="true" />
        <div className="absolute right-12 top-12 h-24 w-24 border-r border-t border-white/10" aria-hidden="true" />
        <div className="absolute bottom-12 left-12 h-24 w-24 border-b border-l border-white/10" aria-hidden="true" />
        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <Logo
            markClassName="border-white/10 bg-white shadow-none"
            textClassName="text-xl text-white"
          />
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-medium text-[#7DD3C7]">Orbit para Alteil Solutions</p>
            <h2 className="max-w-lg text-4xl font-semibold leading-tight text-balance">
              Operaciones claras para equipos de software en movimiento.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
              Una interfaz calmada para decidir rapido, detectar riesgos y mantener el trabajo alineado.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-2 gap-3">
              <PanelStat icon={Layers} label="Proyectos activos" value="24" delta="+8%" />
              <PanelStat icon={Server} label="Servidores online" value="98.6%" delta="+4.3%" />
              <PanelStat icon={ShieldCheck} label="Entregas a tiempo" value="91%" delta="+12%" />
              <PanelStat icon={Activity} label="Alertas abiertas" value="3" delta="-2" accent />
            </div>

            <div className="mt-4 h-28 max-w-xl rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-white/60">
                <span>Ritmo semanal</span>
                <span className="inline-flex items-center gap-1 text-[#7DD3C7]">
                  estable <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <svg viewBox="0 0 420 72" className="h-16 w-full" fill="none" aria-hidden="true">
                <path
                  d="M4 57C38 57 38 40 72 40C106 40 106 26 140 26C174 26 174 44 208 44C242 44 242 18 276 18C310 18 310 35 344 35C378 35 378 12 416 12"
                  stroke="#14B8A6"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M4 57C38 57 38 40 72 40C106 40 106 26 140 26C174 26 174 44 208 44C242 44 242 18 276 18C310 18 310 35 344 35C378 35 378 12 416 12V72H4V57Z"
                  fill="#14B8A6"
                  opacity="0.12"
                />
              </svg>
            </div>
          </div>
          <p className="text-sm text-white/55">Moderno, fiable y preciso.</p>
        </div>
      </div>
    </div>
  )
}

function PanelStat({ icon: Icon, label, value, delta, accent = false }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-[#7DD3C7]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className={accent ? 'text-xs font-medium text-[#FF8A65]' : 'text-xs font-medium text-[#7DD3C7]'}>
          {delta}
        </span>
      </div>
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-2 text-xs text-white/60">{label}</p>
    </div>
  )
}
