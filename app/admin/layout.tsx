import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { UserMenu } from "@/components/dashboard/user-menu"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  // League Control is open to league admins and the main (super) admin.
  // While a super admin previews a lower role, the effective role gates them out.
  if (me.role !== "league_admin" && me.role !== "super_admin") redirect("/dashboard")

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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-border bg-background/95 px-5 backdrop-blur lg:px-10">
          <UserMenu name={me.name} email={me.email} role={me.isSuperAdmin && !me.actingRole ? "main admin" : me.role} />
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  )
}
