import { getCurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { buildNavModel } from "@/lib/nav-model"
import { GlobalBottomNav, type NavUser } from "@/components/site/global-bottom-nav"

/**
 * Server wrapper for the persistent mobile bottom navigation. Resolves the
 * signed-in user and their access context, builds the role-aware nav model, and
 * hands a serialisable model to the client bar. Mounted once in the root layout
 * so the nav stays visible and consistent across public, dashboard and admin
 * sections.
 */
export async function GlobalBottomNavServer() {
  const me = await getCurrentUser()
  const access = me ? await getAccessContext(me) : null
  const model = buildNavModel(me, access)

  const navUser: NavUser | null = me
    ? {
        name: me.name,
        email: me.email,
        role: me.role,
        isSuperAdmin: me.isSuperAdmin,
        actingRole: me.actingRole,
      }
    : null

  return <GlobalBottomNav model={model} user={navUser} />
}
