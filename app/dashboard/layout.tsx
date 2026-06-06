import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  // Players must complete onboarding first (super admins skip this entirely).
  if (!me.playerId && me.role === "player" && !me.isSuperAdmin) redirect("/onboarding")

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:block">
        <DashboardNav
          role={me.role}
          name={me.name}
          email={me.email}
          isSuperAdmin={me.isSuperAdmin}
          actingRole={me.actingRole}
        />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  )
}
