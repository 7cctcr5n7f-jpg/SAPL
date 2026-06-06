import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center", className)}>
      <Image
        src="/sapl-logo.png"
        alt="SAPL — South African Padel League"
        width={440}
        height={156}
        className="h-24 w-auto md:h-28"
        priority
      />
    </Link>
  )
}

export function WordMark({ className }: { className?: string }) {
  return (
    <span className={cn("heading tracking-tight", className)}>
      SOUTH AFRICAN PADEL <span className="text-primary">LEAGUE</span>
    </span>
  )
}
