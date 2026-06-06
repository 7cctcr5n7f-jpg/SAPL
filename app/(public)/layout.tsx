import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getOptionalSession } from "@/lib/session"

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await getOptionalSession()
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader authed={!!session} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
