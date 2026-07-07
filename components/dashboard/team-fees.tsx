"use client"

import { fmtZAR } from "@/lib/format"
import { CheckCircle2, ShieldCheck, CreditCard } from "lucide-react"
import type { PlayerTeamFee } from "@/lib/queries-dashboard"

export function TeamFees({ fees }: { fees: PlayerTeamFee[] }) {
  if (fees.length === 0) return null

  return (
    <div className="space-y-3">
      {fees.map((f) => {
        const isPaid = f.status === "paid"
        const isCovered = f.status === "covered"
        const isDue = f.status === "due"

        return (
          <div
            key={f.teamId}
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

              {/* Badge */}
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
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600">
                      Due
                    </span>
                    <span className="text-[10px] text-muted-foreground">Payment coming soon</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
