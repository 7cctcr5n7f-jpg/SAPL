import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
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
}

export const viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
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
        <Toaster position="top-center" />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
