"use client"

import { useActionState, useState } from "react"
import { updateProfile } from "@/lib/actions/player"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type PlayerLike = {
  bio: string | null
  city: string | null
  playtomicUrl: string | null
  currentLi: number
  playtomicRating: number | null
  preferredClubIds: number[] | null
  anyClub: boolean
  lookingForTeam: boolean
}

type Club = { id: number; name: string }

export function ProfileForm({
  player,
  clubs,
  canEditRatings = false,
}: {
  player: PlayerLike
  clubs: Club[]
  /** League admins may set ratings; players can only view them. */
  canEditRatings?: boolean
}) {
  const [state, action, pending] = useActionState(updateProfile, null)
  const [anyClub, setAnyClub] = useState(player.anyClub)
  const [selectedClubs, setSelectedClubs] = useState<number[]>(player.preferredClubIds ?? [])

  function toggleClub(id: number) {
    setSelectedClubs((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  return (
    <form action={action} className="space-y-5">
      {/* Ratings — only league admins can change these. For everyone else they
          are read-only (the player just supplies their Playtomic link below). */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="playtomicRating">Playtomic Rating</Label>
          {canEditRatings ? (
            <Input
              id="playtomicRating"
              name="playtomicRating"
              type="number"
              step="0.01"
              min="0"
              max="7"
              defaultValue={player.playtomicRating ?? ""}
              placeholder="e.g. 3.50"
            />
          ) : (
            <>
              <p className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                {player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "Not set yet"}
              </p>
              <p className="text-xs text-muted-foreground">Set by the league from your Playtomic profile.</p>
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentLi">League Index (LI)</Label>
          {canEditRatings ? (
            <Input
              id="currentLi"
              name="currentLi"
              type="number"
              step="0.01"
              min="0"
              max="7"
              defaultValue={player.currentLi}
            />
          ) : (
            <>
              <p className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                {player.currentLi.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Your league level, managed by the league.</p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="playtomicUrl">Playtomic Profile URL</Label>
          <Input
            id="playtomicUrl"
            name="playtomicUrl"
            defaultValue={player.playtomicUrl ?? ""}
            placeholder="https://playtomic.io/user/..."
          />
          <p className="text-xs text-muted-foreground">Add your link so the league can verify your rating.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={player.city ?? ""} placeholder="Pretoria" />
        </div>
      </div>

      {/* Preferred home clubs */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Preferred home club</legend>
        <label className="flex items-center gap-3 rounded-md border border-border bg-secondary px-4 py-3">
          <input
            type="checkbox"
            name="anyClub"
            checked={anyClub}
            onChange={(e) => setAnyClub(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm font-semibold">{"I don't mind — any club works"}</span>
        </label>

        {!anyClub && (
          <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
            {clubs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No clubs available yet.</p>
            ) : (
              clubs.map((club) => (
                <label key={club.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="preferredClubIds"
                    value={club.id}
                    checked={selectedClubs.includes(club.id)}
                    onChange={() => toggleClub(club.id)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>{club.name}</span>
                </label>
              ))
            )}
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={player.bio ?? ""}
          placeholder="Tell captains about your playing style, availability, and experience."
        />
      </div>

      <label className="flex items-center gap-3 rounded-md border border-border bg-secondary px-4 py-3">
        <input
          type="checkbox"
          name="lookingForTeam"
          defaultChecked={player.lookingForTeam}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        <span className="text-sm">
          <span className="font-semibold">List me on the marketplace</span>
          <span className="block text-xs text-muted-foreground">
            Captains can discover and invite you to their teams.
          </span>
        </span>
      </label>

      {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm font-medium text-primary">{state.success}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  )
}
