import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'Orbit — Gestión interna para consultoras de software',
  description:
    'Panel unificado para gestionar clientes, facturación, credenciales y servidores VPS.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#100c0f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      data-theme="dark"
      className="dark bg-background"
    >
      <head>
        <meta
          name="sable-verify"
          content="sable-verify-b2cad1533082a7eac1de5f18ab9a3614"
        />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
