"use client"

import { fmtZAR } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Trash2 } from "lucide-react"
import type { PaidPaymentRow } from "@/lib/queries-dashboard"
import { voidPayment } from "@/lib/actions/billing"
import { useState, useTransition } from "react"

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
}

function PaymentRow({ p }: { p: PaidPaymentRow }) {
  const [isPending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)

  function handleDelete() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    startTransition(async () => {
      await voidPayment(p.id)
    })
  }

  return (
    <div className="flex items-center gap-4 border-b border-border py-3 last:border-0">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{p.payerName}</span>
          <Badge variant="secondary" className="text-[10px]">
            {p.type === "team" ? "Team owner · full squad" : "Individual"}
          </Badge>
          <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-0 text-[10px]">
            Paid
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {p.teamName} · {p.email ?? "No email"}
          {p.reference ? ` · Ref: ${p.reference}` : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-foreground">{fmtZAR(p.amount + p.vatAmount)}</p>
        <p className="text-xs text-muted-foreground">Paid {fmtDate(p.paidAt)}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        disabled={isPending}
        onClick={handleDelete}
        title={confirmed ? "Click again to confirm deletion" : "Delete orphaned record"}
        className={confirmed ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-destructive"}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function PaidPayments({ payments }: { payments: PaidPaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No paid payments recorded yet.</p>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card px-4">
      {payments.map((p) => (
        <PaymentRow key={p.id} p={p} />
      ))}
    </div>
  )
}
