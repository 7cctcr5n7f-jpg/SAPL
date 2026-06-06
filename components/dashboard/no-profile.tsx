import Link from "next/link"
import { UserPlus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/dashboard/page-header"

export function NoProfile({
  title,
  subtitle,
  message,
}: {
  title: string
  subtitle: string
  message: string
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
          </span>
          <div className="space-y-1">
            <h3 className="heading text-lg">No player profile yet</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">{message}</p>
          </div>
          <Link href="/onboarding" className={buttonVariants()}>
            Create your player profile
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
