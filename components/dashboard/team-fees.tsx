"use client"

import { useState, useTransition } from "react"
import { fmtZAR } from "@/lib/format"
import { CheckCircle2, ShieldCheck, CreditCard, Loader2 } from "lucide-react"
import type { PlayerTeamFee } from "@/lib/queries-dashboard"
import { createPlayerPayment } from "@/lib/actions/payments"
import { toast } from "sonner"

export function TeamFees({ fees }: { fees: PlayerTeamFee[] }) {
  if (fees.length === 0) return null

  return (
    <div className="space-y-3">
      {fees.map((f) => (
        <TeamFeeRow key={f.teamId} fee={f} />
      ))}
    </div>
  )
}

function TeamFeeRow({ fee: f }: { fee: PlayerTeamFee }) {
  const isPaid = f.status === "paid"
  const isCovered = f.status === "covered"
  const isDue = f.status === "due"
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  function handlePay() {
    setLoading(true)
    startTransition(async () => {
      const res = await createPlayerPayment(f.teamId)
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
        isDue
          ? "border-amber-400/40 bg-amber-500/5"
          : isCovered
          ? "border-sky-400/30 bg-sky-500/5"
          : "border-emerald-400/30 bg-emerald-500/5"
      }`}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div
          className={`shrink-0 rounded-xl p-2.5 ${
            isDue ? "bg-amber-500/15 text-amber-600" : isCovered ? "bg-sky-500/15 text-sky-600" : "bg-emerald-500/15 text-emerald-600"
          }`}
        >
          {isCovered ? (
            <ShieldCheck className="h-5 w-5" />
          ) : isPaid ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground leading-tight">{f.teamName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isCovered
              ? "Your club is covering your league fee"
              : `League fee ${fmtZAR(f.amount + f.vatAmount)} incl. VAT`}
          </p>
        </div>

        {/* Badge / action */}
        <div className="shrink-0 text-right">
          {isCovered && (
            <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-600">
              Covered
            </span>
          )}
          {isPaid && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600">
              Paid
            </span>
          )}
          {isDue && (
            <button
              type="button"
              onClick={handlePay}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
