import type { ReactNode } from "react"
import { SectionTitle } from "@/components/brand/bits"
import { LegalLinks } from "@/components/legal/legal-links"

function LegalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="heading text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}

export function LegalPageShell({
  eyebrow = "Legal",
  title,
  intro,
  children,
}: {
  eyebrow?: string
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <SectionTitle eyebrow={eyebrow} title={title} />
      <p className="mt-3 text-muted-foreground leading-relaxed">{intro}</p>
      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
        This page contains placeholder content and requires legal review before production launch.
      </div>
      <div className="mt-6">
        <LegalLinks className="text-sm text-muted-foreground" />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  )
}

export { LegalBlock }

