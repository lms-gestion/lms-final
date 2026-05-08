import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { TrpcProvider } from '@/lib/trpc/provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'LMS Gestion',
    template: '%s · LMS Gestion',
  },
  description: 'Gestion interne — La Maison des Services',
  applicationName: 'LMS Gestion',
  icons: { icon: '/favicon.ico' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F2644',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <TrpcProvider>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TrpcProvider>
      </body>
    </html>
  )
}
