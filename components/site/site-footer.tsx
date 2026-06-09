import Link from "next/link"
import { WordMark } from "@/components/brand/logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <WordMark className="text-2xl" />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              South Africa&apos;s premier padel competition ecosystem. From Tshwane regional play to national
              championships.
            </p>
          </div>
          <div>
            <h3 className="heading text-sm tracking-widest">Compete</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link href="/league-centre" className="hover:text-primary">League Centre</Link></li>
              <li><Link href="/rankings" className="hover:text-primary">Rankings</Link></li>
              <li><Link href="/marketplace" className="hover:text-primary">Marketplace</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="heading text-sm tracking-widest">League</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link href="/clubs" className="hover:text-primary">Clubs</Link></li>
              <li><Link href="/sponsors" className="hover:text-primary">Sponsors</Link></li>
              <li><Link href="/rules" className="hover:text-primary">Rules &amp; Format</Link></li>
              <li><Link href="/contact" className="hover:text-primary">Contact</Link></li>
              <li><Link href="/sign-up" className="hover:text-primary">Register</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <span>&copy; {new Date().getFullYear()} South African Padel League. All rights reserved.</span>
          <span className="uppercase tracking-widest">Tshwane &middot; Gauteng &middot; South Africa</span>
        </div>
      </div>
    </footer>
  )
}
