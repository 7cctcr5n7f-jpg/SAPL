import type { Metadata } from 'next'
import { Geist, Geist_Mono, Archivo } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Navbar } from '@/components/navbar'
import { SiteFooter } from '@/components/site-footer'
import { WhatsAppFloat } from '@/components/whatsapp-float'
import { SpecialsGlobal } from '@/components/specials/specials-global'
import { JsonLd } from '@/components/json-ld'
import { localBusinessSchema, websiteSchema } from '@/lib/seo'
import { business } from '@/lib/business'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: ['600', '700', '800', '900'],
})

export const metadata: Metadata = {
  metadataBase: new URL(business.url),
  title: {
    default: 'TENROUNDS | 30-Minute HIIT Gym in Garsfontein, Pretoria East',
    template: '%s | TENROUNDS',
  },
  description:
    'TENROUNDS is a boutique HIIT gym in Garsfontein, Pretoria East delivering coach-supported 30-minute workouts with no class times. Strength, cardio and functional training for real results.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: 'TENROUNDS',
    url: business.url,
    title: 'TENROUNDS | 30-Minute HIIT Gym in Garsfontein, Pretoria East',
    description:
      'Coach-supported 30-minute HIIT workouts with no class times in Garsfontein, Pretoria East.',
    images: [{ url: '/hero-athlete.png', width: 1200, height: 630, alt: 'TENROUNDS HIIT gym' }],
  },
  keywords: [
    'HIIT Gym Pretoria',
    'Functional Fitness Pretoria',
    'Boutique Gym Pretoria',
    'Fitness Classes Pretoria East',
    '30 Minute Workout Pretoria',
    'Personal Training Alternative Pretoria',
    'Strength and Conditioning Pretoria',
    'Corporate Wellness Pretoria',
  ],
  generator: 'v0.app',
}

export const viewport = {
  themeColor: '#0b0b0b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${geist.variable} ${geistMono.variable} ${archivo.variable} font-sans antialiased`}
      >
        <JsonLd data={[localBusinessSchema(), websiteSchema()]} />
        <SpecialsGlobal />
        <Navbar />
        {children}
        <SiteFooter />
        <WhatsAppFloat />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
