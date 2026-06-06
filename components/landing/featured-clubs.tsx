import Link from "next/link"
import Image from "next/image"
import type { FeaturedClub } from "@/lib/queries-landing"
import { Building2, ArrowUpRight } from "lucide-react"
import { Reveal } from "./reveal"

export function FeaturedClubs({ clubs }: { clubs: FeaturedClub[] }) {
  if (clubs.length === 0) return null
  return (
    <section className="border-y border-border/60 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">The Clubs</span>
            <h2 className="heading mt-3 text-4xl text-balance md:text-5xl">The Clubs Of SAPL</h2>
          </div>
          <Link
            href="/clubs"
            className="hidden items-center gap-1 text-sm font-semibold uppercase tracking-widest text-primary hover:underline sm:inline-flex"
          >
            All clubs <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <Reveal
          delay={80}
          as="ul"
          className="mt-12 grid grid-cols-3 gap-px bg-border/60 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
        >
          {clubs.map((c) => (
            <li key={c.id}>
              <Link
                href={c.slug ? `/clubs/${c.slug}` : "/clubs"}
                className="group flex aspect-square flex-col items-center justify-center gap-3 bg-card p-3 text-center transition-colors hover:bg-background"
              >
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden md:h-16 md:w-16">
                  {c.logoUrl ? (
                    <Image
                      src={c.logoUrl || "/placeholder.svg"}
                      alt={`${c.name} logo`}
                      width={72}
                      height={72}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <Building2 className="h-7 w-7 text-muted-foreground transition-transform duration-300 group-hover:scale-110 group-hover:text-primary" />
                  )}
                </span>
                <span className="line-clamp-2 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">
                  {c.name}
                </span>
              </Link>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
