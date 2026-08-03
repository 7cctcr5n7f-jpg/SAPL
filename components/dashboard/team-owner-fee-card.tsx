"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react"
import { fmtZAR } from "@/lib/format"
import { createTeamPayment } from "@/lib/actions/payments"
import { toast } from "sonner"
import type { TeamOwnerFee } from "@/lib/queries-dashboard"

export function TeamOwnerFeeCard({ fee }: { fee: TeamOwnerFee }) {
  const total = fee.amount + fee.vatAmount
  const isPaid = fee.status === "paid"
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  function handlePay() {
    setLoading(true)
    startTransition(async () => {
      const res = await createTeamPayment(fee.teamId)
      setLoading(false)
      if (res.ok) {
        window.location.href = res.url
      } else {
        toast.error(res.error ?? "Could not create payment link")
      }
    })
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        isPaid ? "border-emerald-400/30 bg-emerald-500/5" : "border-amber-400/40 bg-amber-500/5"
      }`}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div
          className={`shrink-0 rounded-xl p-2.5 ${
            isPaid ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
          }`}
        >
          {isPaid ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground leading-tight">{fee.teamName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Team league fee — {fmtZAR(total)} incl. VAT (full squad of 8)
          </p>
          {!isPaid && (
            <p className="text-xs text-amber-600 font-medium mt-1">
              You selected &apos;team pays fees&apos; — you are responsible for paying for your entire squad.
            </p>
          )}
        </div>

        {/* Badge / action */}
        <div className="shrink-0 text-right">
          {isPaid ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600">
              Paid
            </span>
          ) : (
            <button
              type="button"
              onClick={handlePay}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
              Pay R4,000
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
