"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createPlayerProfile, type OnboardingState } from "@/lib/actions/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useFormStatus } from "react-dom"

type Club = { id: number; name: string }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
    </Button>
  )
}

export function OnboardingForm({ defaultName, clubs }: { defaultName?: string; clubs: Club[] }) {
  const router = useRouter()
  const [state, action] = useActionState<OnboardingState, FormData>(createPlayerProfile, {})
  const [firstName, lastName] = (defaultName ?? "").split(" ")
  const [anyClub, setAnyClub] = useState(true)
  const [selectedClubs, setSelectedClubs] = useState<number[]>([])

  function toggleClub(id: number) {
    setSelectedClubs((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  useEffect(() => {
    if (state.success) {
      router.push("/dashboard")
      router.refresh()
    }
  }, [state.success, router])

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required defaultValue={firstName ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required defaultValue={lastName ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="gender">Gender</Label>
          <Select name="gender" defaultValue="male">
            <SelectTrigger id="gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">WhatsApp number</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+27 ..." />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="playtomicUrl">Playtomic profile URL</Label>
        <Input id="playtomicUrl" name="playtomicUrl" placeholder="https://playtomic.io/..." />
        <span className="text-xs text-muted-foreground">
          Your League Index is set by a league admin — no need to enter it here.
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Preferred home club</legend>
        <label className="flex items-center gap-3 border border-border bg-card p-3">
          <input
            type="checkbox"
            name="anyClub"
            checked={anyClub}
            onChange={(e) => setAnyClub(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm font-semibold">{"I don't mind — any club works"}</span>
        </label>
        {!anyClub && (
          <div className="grid max-h-56 gap-2 overflow-y-auto border border-border p-3 sm:grid-cols-2">
            {clubs.length === 0 ? (
              <span className="text-xs text-muted-foreground">No clubs available yet.</span>
            ) : (
              clubs.map((club) => (
                <label key={club.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="preferredClubIds"
                    value={club.id}
                    checked={selectedClubs.includes(club.id)}
                    onChange={() => toggleClub(club.id)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  <span>{club.name}</span>
                </label>
              ))
            )}
          </div>
        )}
      </fieldset>

      <label className="flex items-center gap-3 border border-border bg-card p-4">
        <input type="checkbox" name="lookingForTeam" defaultChecked className="size-4 accent-[var(--color-primary)]" />
        <span className="text-sm">List me on the player marketplace so captains can recruit me.</span>
      </label>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <SubmitButton />
    </form>
  )
}
