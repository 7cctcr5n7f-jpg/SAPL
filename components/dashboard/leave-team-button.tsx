"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { leaveTeam } from "@/lib/actions/player"
import { Button } from "@/components/ui/button"

/**
 * Compact "Leave team" control used in the Player Overview summary bar.
 * Captains can't leave (handled by hiding the button at the call site).
 */
export function LeaveTeamButton({ membershipId, className }: { membershipId: number; className?: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  function leave() {
    start(async () => {
      const res = await leaveTeam(membershipId)
      if (res?.error) toast.error(res.error)
      else {
        toast.success(res?.success ?? "Left team")
        router.refresh()
      }
    })
  }

  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={leave} className={className}>
      {pending ? "Leaving…" : "Leave team"}
    </Button>
  )
}
