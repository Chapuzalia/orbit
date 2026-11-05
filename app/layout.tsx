import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'Orbit — Gestión interna para consultoras de software',
  description:
    'Panel unificado para gestionar clientes, facturación, credenciales y servidores VPS.',
  generator: 'v0.app',
  applicationName: 'Orbit',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
  // Home-screen launch on iOS opens full screen, without Safari's bars.
  appleWebApp: {
    capable: true,
    title: 'Orbit',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#100c0f',
  // Lets the page draw under the notch; the shell pads itself with safe-area insets.
  viewportFit: 'cover',
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
        {/* Next only emits mobile-web-app-capable; iOS before 16.4 still needs the apple- name for standalone. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
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
