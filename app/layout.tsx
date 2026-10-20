import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Big_Shoulders, Overpass } from 'next/font/google'
import './globals.css'

const display = Big_Shoulders({ subsets: ['latin'], variable: '--font-display', axes: ['opsz'] })
const body = Overpass({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'The Walking Dead — The Game | Mundo e oficina 3D PBR',
  description:
    'Explore o mundo procedural original e a oficina 3D de estruturas pós-apocalípticas. Módulos detalhados com texturas PBR, interiores acessíveis, recursos contextuais e auditoria de geometria para a futura geração de cidades.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1b1c16',
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} bg-background`}>
      <body className="overflow-hidden font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
