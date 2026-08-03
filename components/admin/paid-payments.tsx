import { fmtZAR } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import type { PaidPaymentRow } from "@/lib/queries-dashboard"

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
}

export function PaidPayments({ payments }: { payments: PaidPaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No paid payments recorded yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {payments.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="font-semibold text-foreground">{p.payerName}</span>
                {p.type === "team" ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Team owner · full squad
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Individual
                  </Badge>
                )}
                <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-0 text-[10px]">
                  Paid
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.teamName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.email ?? "No email"}
                {p.reference ? ` · Ref: ${p.reference}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
              <span className="text-lg font-semibold text-foreground">
                {fmtZAR(p.amount + p.vatAmount)}
              </span>
              <span className="text-xs text-muted-foreground">Paid {fmtDate(p.paidAt)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
