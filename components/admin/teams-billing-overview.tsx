"use client"

import { useState } from "react"
import type { TeamBillingRow } from "@/lib/queries-dashboard"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Clock, ShieldCheck, Users } from "lucide-react"

function ProgressPip({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${filled ? "bg-emerald-500" : "bg-muted-foreground/25"}`}
    />
  )
}

function PaymentProgress({ row }: { row: TeamBillingRow }) {
  if (row.clubPaysFees) {
    const paid = row.ownerPaid
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <ProgressPip filled={paid} />
        </div>
        <span className={`text-sm font-semibold tabular-nums ${paid ? "text-emerald-600" : "text-amber-600"}`}>
          {paid ? "1/1" : "0/1"}
        </span>
        <span className="text-xs text-muted-foreground">owner</span>
      </div>
    )
  }

  const total = row.memberCount
  const paid = row.paidCount
  const pips = Math.min(total, 12) // cap visual pips at 12
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 flex-wrap max-w-[120px]">
        {Array.from({ length: pips }).map((_, i) => (
          <ProgressPip key={i} filled={i < Math.min(paid, pips)} />
        ))}
        {total > 12 && <span className="text-[10px] text-muted-foreground">+{total - 12}</span>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${paid === total && total > 0 ? "text-emerald-600" : paid > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
        {paid}/{total}
      </span>
    </div>
  )
}

export function TeamsBillingOverview({ teams }: { teams: TeamBillingRow[] }) {
  const [query, setQuery] = useState("")

  const filtered = query.trim()
    ? teams.filter((t) => t.teamName.toLowerCase().includes(query.toLowerCase()))
    : teams

  const totalTeams = teams.length
  const fullyPaid = teams.filter((t) =>
    t.clubPaysFees ? t.ownerPaid : t.memberCount > 0 && t.paidCount === t.memberCount,
  ).length
  const ownerPending = teams.filter((t) => t.clubPaysFees && !t.ownerPaid).length
  const playersPaid = teams.filter((t) => !t.clubPaysFees).reduce((s, t) => s + t.paidCount, 0)
  const playersTotal = teams.filter((t) => !t.clubPaysFees).reduce((s, t) => s + t.memberCount, 0)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total teams", value: totalTeams, icon: <Users className="h-4 w-4" /> },
          { label: "Fully settled", value: fullyPaid, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
          { label: "Owners pending", value: ownerPending, icon: <ShieldCheck className="h-4 w-4 text-amber-500" /> },
          { label: "Players paid", value: `${playersPaid}/${playersTotal}`, icon: <Clock className="h-4 w-4 text-sky-500" /> },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <div className="text-muted-foreground">{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-foreground leading-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search team..."
        className="max-w-xs"
      />

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Team</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progress</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((t) => {
              const isFullyPaid = t.clubPaysFees
                ? t.ownerPaid
                : t.memberCount > 0 && t.paidCount === t.memberCount
              const isPartial = !t.clubPaysFees && t.paidCount > 0 && t.paidCount < t.memberCount
              const hasNoMembers = !t.clubPaysFees && t.memberCount === 0

              return (
                <tr key={t.teamId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{t.teamName}</p>
                    {t.clubPaysFees && t.ownerName && (
                      <p className="text-xs text-muted-foreground">{t.ownerName}</p>
                    )}
                    {!t.divisionId && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Not placed in division</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.clubPaysFees ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Club pays
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Users className="h-3 w-3" />
                        Individual
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hasNoMembers ? (
                      <span className="text-xs text-muted-foreground/60">No active members</span>
                    ) : (
                      <PaymentProgress row={t} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isFullyPaid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Paid
                      </span>
                    ) : isPartial ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                        <Clock className="h-3 w-3" /> Partial
                      </span>
                    ) : hasNoMembers ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        No members
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                        <Clock className="h-3 w-3" /> Outstanding
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No teams match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
