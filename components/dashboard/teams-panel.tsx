"use client"

import Link from "next/link"
import { useTransition } from "react"
import { respondToInvite, leaveTeam } from "@/lib/actions/player"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

type Entry = {
  membershipId: number
  status: string
  teamId: number
  teamName: string
  orgName: string
  divisionName: string
  tpr: number
  role: string
}

export function TeamsPanel({ entries }: { entries: Entry[] }) {
  const [pending, startTransition] = useTransition()

  const invited = entries.filter((e) => e.status === "invited")
  const active = entries.filter((e) => e.status === "active")
  const past = entries.filter((e) => !["invited", "active"].includes(e.status))

  function respond(id: number, accept: boolean) {
    startTransition(async () => {
      const res = await respondToInvite(id, accept)
      if (res?.error) toast.error(res.error)
      else toast.success(res?.success ?? "Done")
    })
  }

  function leave(id: number) {
    startTransition(async () => {
      const res = await leaveTeam(id)
      if (res?.error) toast.error(res.error)
      else toast.success(res?.success ?? "Left team")
    })
  }

  return (
    <div className="space-y-8">
      {invited.length > 0 && (
        <section>
          <h2 className="heading mb-3 text-lg">Pending Invitations</h2>
          <div className="space-y-3">
            {invited.map((e) => (
              <Card key={e.membershipId} className="border-primary/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                  <div>
                    <p className="font-semibold">{e.teamName}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.orgName} · {e.divisionName} · TPR {Math.round(e.tpr)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => respond(e.membershipId, true)}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => respond(e.membershipId, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="heading mb-3 text-lg">Active Teams</h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              You&apos;re not on any active teams.{" "}
              <Link href="/marketplace" className="text-primary hover:underline">
                Browse the marketplace
              </Link>{" "}
              to find one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((e) => (
              <Card key={e.membershipId}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                  <div className="flex items-center gap-3">
                    <div>
                      <Link href={`/teams/${e.teamId}`} className="font-semibold hover:text-primary">
                        {e.teamName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {e.orgName} · {e.divisionName} · TPR {Math.round(e.tpr)}
                      </p>
                    </div>
                    {e.role === "captain" && <Badge>Captain</Badge>}
                  </div>
                  {e.role !== "captain" && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => leave(e.membershipId)}>
                      Leave
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="heading mb-3 text-lg text-muted-foreground">History</h2>
          <div className="space-y-2">
            {past.map((e) => (
              <div
                key={e.membershipId}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm"
              >
                <span>{e.teamName}</span>
                <Badge variant="outline" className="capitalize">
                  {e.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
