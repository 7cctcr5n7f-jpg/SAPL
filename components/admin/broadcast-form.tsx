"use client"

import { useActionState } from "react"
import { broadcastNotification } from "@/lib/actions/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const AUDIENCES = [
  { value: "all", label: "All players" },
  { value: "captains", label: "Captains only" },
  { value: "org_admins", label: "Team managers" },
]

export function BroadcastForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { ok?: boolean; error?: string; count?: number } | null, fd: FormData) =>
      broadcastNotification(fd),
    null,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compose Broadcast</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audience">Audience</Label>
            <select
              id="audience"
              name="audience"
              defaultValue="all"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Round 7 fixtures released" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" required rows={4} placeholder="Write your announcement..." />
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state?.ok ? (
            <p className="text-sm text-emerald-600">Sent to {state.count} recipient(s).</p>
          ) : null}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Sending..." : "Send Broadcast"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
