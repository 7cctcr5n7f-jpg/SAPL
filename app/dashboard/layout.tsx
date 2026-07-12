import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { UserMenu } from "@/components/dashboard/user-menu"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  // Only pure "player" role users who haven't completed onboarding get redirected.
  // Captains, team managers, and super admins bypass onboarding regardless of isPlayer.
  if (!me.isPlayer && me.realRole === "player") redirect("/onboarding")

  const access = await getAccessContext(me)

  return (
    <div className="dashboard-light flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:block">
        <DashboardNav
          role={me.role}
          name={me.name}
          email={me.email}
          isSuperAdmin={me.isSuperAdmin}
          actingRole={me.actingRole}
          permissions={[...access.permissions]}
        />
      </div>
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-border bg-background/95 px-5 backdrop-blur lg:px-10">
          <UserMenu name={me.name} email={me.email} role={me.isSuperAdmin && !me.actingRole ? "main admin" : me.role} />
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 pb-24 lg:px-10 lg:pb-8">{children}</div>
      </main>
    </div>
  )
}
