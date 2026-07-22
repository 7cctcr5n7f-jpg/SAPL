import Link from "next/link"
import { cn } from "@/lib/utils"

const LEGAL_LINKS = [
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/cancellation-policy", label: "Cancellation Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/privacy-policy", label: "Privacy Policy" },
] as const

export function LegalLinks({
  className,
  linkClassName,
  stacked = false,
}: {
  className?: string
  linkClassName?: string
  stacked?: boolean
}) {
  return (
    <div className={cn(stacked ? "flex flex-col gap-2" : "flex flex-wrap gap-x-4 gap-y-2", className)}>
      {LEGAL_LINKS.map((item) => (
        <Link key={item.href} href={item.href} className={cn("hover:text-primary hover:underline", linkClassName)}>
          {item.label}
        </Link>
      ))}
    </div>
  )
}

export function RegistrationComplianceNotice({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-4", className)}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        <strong className="text-foreground">South African Padel League (SAPL)</strong> is the organiser and sole
        beneficiary of all registration fees collected through this platform. Payments are not processed on behalf of
        clubs, teams, venues, or any third parties.
      </p>
    </div>
  )
}

