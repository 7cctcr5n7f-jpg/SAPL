"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { resolveDispute } from "@/lib/actions/admin"
import { toast } from "sonner"

type Dispute = {
  id: number
  fixtureId: number | null
  type: string
  status: string
  description: string
  createdAt: string | Date
}

export function DisputesPanel({ disputes }: { disputes: Dispute[] }) {
  const [pending, start] = useTransition()
  const [resolving, setResolving] = useState<Dispute | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Disputes &amp; Protests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {disputes.length === 0 && <p className="text-sm text-muted-foreground">No open disputes. All clear.</p>}
        {disputes.map((d) => (
          <div key={d.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">
                {d.type}
              </Badge>
              <Badge variant={d.status === "open" ? "destructive" : "secondary"} className="capitalize">
                {d.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="mt-2 text-sm">{d.description}</p>
            {d.fixtureId && <p className="mt-1 text-xs text-muted-foreground">Fixture #{d.fixtureId}</p>}
            <Button size="sm" className="mt-3" onClick={() => setResolving(d)}>
              Review &amp; resolve
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
          </DialogHeader>
          {resolving && (
            <form
              action={(fd) => {
                fd.set("disputeId", String(resolving.id))
                start(async () => {
                  const res = await resolveDispute(fd)
                  if (res.ok) {
                    toast.success("Dispute resolved")
                    setResolving(null)
                  } else toast.error(res.error ?? "Failed")
                })
              }}
              className="space-y-4"
            >
              <p className="rounded-md bg-secondary/40 p-3 text-sm">{resolving.description}</p>
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution notes</Label>
                <Textarea id="resolution" name="resolution" required placeholder="Decision and reasoning..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="penalty">Penalty (optional)</Label>
                <Input id="penalty" name="penalty" placeholder="e.g. 3-point deduction" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Outcome</Label>
                <select
                  id="status"
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="resolved">Uphold / Resolve</option>
                  <option value="rejected">Reject dispute</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  Submit decision
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
