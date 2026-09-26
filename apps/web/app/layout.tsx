import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'Dhaka Tesla Pool — Smart EV Ride Pooling',
  description: 'Book sustainable, affordable Tesla ride pools across Dhaka. Save up to 45% with pooling discounts.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B111E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.className}`}>
      <body className="min-h-dvh bg-dhaka-night text-dhaka-text-headline antialiased selection:bg-dhaka-cobalt/30">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

