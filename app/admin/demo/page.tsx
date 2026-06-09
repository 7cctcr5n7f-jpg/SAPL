import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { IS_DEMO, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo"
import { DemoControls } from "@/components/admin/demo-controls"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Demo Controls" }

export default async function AdminDemoPage() {
  // Hard gate: this page does not exist outside the Demo Environment.
  if (!IS_DEMO) notFound()

  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  const access = await getAccessContext(me)
  if (!access.permissions.has("league_management")) redirect("/admin")

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Demo Controls</h1>
          <Badge className="bg-primary text-primary-foreground">Demo Environment</Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground leading-relaxed">
          Manage the sandbox data testers explore. These tools only affect the isolated demo database — the live SAPL
          production environment is on a completely separate database and is never touched.
        </p>
      </header>

      <DemoControls />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Demo logins</h2>
        <p className="text-sm text-muted-foreground">
          Every account uses the password{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{DEMO_PASSWORD}</code>. These are
          recreated on every reset or regenerate.
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ACCOUNTS.map((a) => (
                <tr key={a.key} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{a.label}</td>
                  <td className="px-4 py-2 font-mono text-muted-foreground">{a.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
