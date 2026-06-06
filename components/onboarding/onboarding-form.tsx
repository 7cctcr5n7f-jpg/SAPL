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
import { SA_PROVINCES, PLAYER_FORMATS } from "@/lib/constants"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="province">Province</Label>
          <Select name="province" defaultValue="Gauteng">
            <SelectTrigger id="province">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SA_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Pretoria" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentLi">League Index (LI)</Label>
          <Input
            id="currentLi"
            name="currentLi"
            type="number"
            step="0.1"
            min="0"
            max="7"
            placeholder="3.0"
          />
          <span className="text-xs text-muted-foreground">Your highest Playtomic rating in the last 6 months.</span>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="playtomicUrl">Playtomic profile URL</Label>
          <Input id="playtomicUrl" name="playtomicUrl" placeholder="https://playtomic.io/..." />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Formats I want to play</legend>
        <span className="text-xs text-muted-foreground">
          Pick one or both. Your level decides which category you land in.
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAYER_FORMATS.map((f) => (
            <label key={f.value} className="flex items-start gap-3 border border-border bg-card p-3">
              <input
                type="checkbox"
                name="preferredFormats"
                value={f.value}
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
              />
              <span className="text-sm">
                <span className="font-semibold">{f.label}</span>
                <span className="block text-xs text-muted-foreground">{f.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
