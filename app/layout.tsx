import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/sonner"
import { PwaProvider } from "@/components/pwa/pwa-provider"
import { GlobalBottomNavServer } from "@/components/site/global-bottom-nav-server"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Oswald } from "next/font/google"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
})

export const metadata: Metadata = {
  title: {
    default: "South African Padel League",
    template: "%s — SAPL",
  },
  description:
    "The premier padel competition platform. Live rankings, standings, fixtures, Team Power Ratings, Club Performance Index, and the road to the Tshwane Masters.",
  generator: "v0.app",
  keywords: ["padel", "league", "Tshwane", "rankings", "TPR", "CPI", "South Africa"],
  applicationName: "SAPL",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SAPL",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${oswald.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Suspense fallback={null}>
          <GlobalBottomNavServer />
        </Suspense>
        <PwaProvider />
        <Toaster position="top-center" />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
