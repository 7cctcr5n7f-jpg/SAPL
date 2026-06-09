import { notFound } from "next/navigation"
import { SectionTitle } from "@/components/brand/bits"
import { DemoAccountList } from "@/components/site/demo-account-list"
import { IS_DEMO, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo"

export const metadata = {
  title: "Demo Logins | SAPL",
  description: "Explore the South African Padel League platform with ready-made demo accounts for every role.",
}

export default function DemoPage() {
  // The demo helper only exists on the demo deployment.
  if (!IS_DEMO) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      <SectionTitle eyebrow="Demo Environment" title="Explore SAPL with sample data" />
      <p className="mt-3 max-w-2xl text-muted-foreground">
        This is a fully isolated demo running on sample data — nothing here affects the live league. Pick a role
        below and sign in to explore the platform from that perspective. Every account uses the same password.
      </p>

      <div className="mt-6 inline-flex flex-col gap-1 border border-border bg-card px-4 py-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Shared password</span>
        <span className="font-mono text-sm">{DEMO_PASSWORD}</span>
      </div>

      <div className="mt-8">
        <DemoAccountList accounts={DEMO_ACCOUNTS} password={DEMO_PASSWORD} />
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Data can be reset at any time by an administrator, so feel free to create teams, edit rosters, record results
        and explore freely.
      </p>
    </div>
  )
}
