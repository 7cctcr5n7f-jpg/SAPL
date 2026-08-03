"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { OutstandingFee } from "@/lib/queries-dashboard"
import { saveFeeNote, sendFeeReminder } from "@/lib/actions/billing"
import { fmtZAR } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Stat } from "@/components/brand/bits"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, StickyNote, Send, CheckCircle2 } from "lucide-react"
import { markPaymentPaid } from "@/lib/actions/payments"

type PaidFilter = "all" | "unpaid"
type KindFilter = "all" | "player" | "team"

function feeKey(f: OutstandingFee) {
  return { kind: f.kind, teamId: f.teamId, playerId: f.playerId }
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
}

export function BillingManagement({ fees }: { fees: OutstandingFee[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  // Outstanding fees are by definition unpaid; the "paid" view is intentionally
  // empty but kept so admins can confirm there's nothing outstanding for a payer.
  const [paid, setPaid] = useState<PaidFilter>("unpaid")
  const [kind, setKind] = useState<KindFilter>("all")
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [noteModal, setNoteModal] = useState<OutstandingFee | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return fees.filter((f) => {
      if (paid === "all") {
        // no-op: outstanding list only holds unpaid items
      }
      if (kind !== "all" && f.kind !== kind) return false
      return f.playerName.toLowerCase().includes(q) || f.teamName.toLowerCase().includes(q)
    })
  }, [fees, query, paid, kind])

  const total = filtered.reduce((s, f) => s + f.amount + f.vatAmount, 0)
  const uniquePlayers = new Set(filtered.filter((f) => f.kind === "player").map((f) => f.playerId)).size
  const fundingTeams = filtered.filter((f) => f.kind === "team").length

  function keyId(f: OutstandingFee) {
    return `${f.kind}-${f.teamId}-${f.playerId}`
  }

  function remind(f: OutstandingFee) {
    if (!f.email) {
      toast.error("No email on file for this payer.")
      return
    }
    setPendingKey(keyId(f))
    startTransition(async () => {
      const res = await sendFeeReminder({
        key: feeKey(f),
        email: f.email,
        payerName: f.playerName,
        teamName: f.teamName,
        amount: f.amount + f.vatAmount,
      })
      setPendingKey(null)
      if (res.ok) {
        toast.success(res.sent ? `Reminder emailed to ${f.email}` : "Reminder logged (email not configured)")
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not send reminder")
      }
    })
  }

  function markPaid(f: OutstandingFee) {
    setPendingKey(`paid-${keyId(f)}`)
    startTransition(async () => {
      const res = await markPaymentPaid({
        type: f.kind === "team" ? "team" : "individual",
        teamId: f.teamId,
        playerId: f.playerId,
      })
      setPendingKey(null)
      if (res.ok) {
        toast.success(`${f.playerName} marked as paid`)
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not mark as paid")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <Stat label="Total outstanding" value={fmtZAR(total)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Players owing" value={uniquePlayers} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Funding teams owing" value={fundingTeams} />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search payer or team..."
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={paid}
            onChange={(e) => setPaid(e.target.value as PaidFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Payment status"
          >
            <option value="unpaid">Unpaid</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Payer type"
          >
            <option value="all">All payers</option>
            <option value="player">Players</option>
            <option value="team">Funding teams</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outstanding fees match your filters.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {filtered.map((f) => {
            const busy = pendingKey === keyId(f)
            const busyPaid = pendingKey === `paid-${keyId(f)}`
            return (
              <div key={keyId(f)} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{f.playerName}</span>
                    {f.kind === "team" && (
                      <Badge variant="secondary" className="text-[10px]">Team owner</Badge>
                    )}
                    <Badge variant="destructive" className="text-[10px]">Due</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.teamName}
                    {f.email ? ` · ${f.email}` : ""}
                    {f.phone ? ` · ${f.phone}` : ""}
                  </p>
                  {f.note && (
                    <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{f.note}&rdquo;</p>
                  )}
                  {f.lastReminderAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Last reminder {fmtDate(f.lastReminderAt)} · {f.reminderCount} sent
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-2 text-sm font-semibold tabular-nums text-foreground">
                    {fmtZAR(f.amount + f.vatAmount)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title={f.note ? "Edit note" : "Add note"}
                    onClick={() => setNoteModal(f)}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Send reminder"
                    disabled={busy || !f.email}
                    onClick={() => remind(f)}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                    title="Mark as paid"
                    disabled={busyPaid}
                    onClick={() => markPaid(f)}
                  >
                    {busyPaid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {noteModal ? (
        <NoteDialog
          fee={noteModal}
          onClose={() => setNoteModal(null)}
          onSaved={() => {
            setNoteModal(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function NoteDialog({
  fee,
  onClose,
  onSaved,
}: {
  fee: OutstandingFee
  onClose: () => void
  onSaved: () => void
}) {
  const [note, setNote] = useState(fee.note ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await saveFeeNote(feeKey(fee), note)
      if (res.ok) {
        toast.success("Note saved")
        onSaved()
      } else {
        toast.error("Could not save note")
      }
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Note · {fee.playerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {fee.teamName} · {fmtZAR(fee.amount + fee.vatAmount)} outstanding
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Promised to pay by Friday, awaiting EFT proof..."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
