"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fmtZAR } from "@/lib/format"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import type { PlayerTeamFee } from "@/lib/queries-dashboard"

export function TeamFees({ fees }: { fees: PlayerTeamFee[] }) {
  if (fees.length === 0) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Team Fees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {fees.map((f) => (
          <div
            key={f.teamId}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold">{f.teamName}</p>
              <p className="text-xs text-muted-foreground">
                {f.status === "covered"
                  ? "Your team manager is covering your league fee"
                  : `League join fee ${fmtZAR(f.amount + f.vatAmount)} incl. VAT`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {f.status === "covered" ? (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Covered by club
                </Badge>
              ) : f.status === "paid" ? (
                <Badge className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                </Badge>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="destructive">Due</Badge>
                  <span className="text-xs text-muted-foreground">Online payment coming next week</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
