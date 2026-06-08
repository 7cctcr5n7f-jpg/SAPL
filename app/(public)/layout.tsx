import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getCurrentUser } from "@/lib/session"

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        user={user ? { name: user.name, email: user.email, role: user.role } : null}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
