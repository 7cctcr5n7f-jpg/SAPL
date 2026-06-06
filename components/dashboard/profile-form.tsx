"use client"

import { useActionState, useState } from "react"
import { updateProfile } from "@/lib/actions/player"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORY_RULES, PLAYER_FORMATS } from "@/lib/constants"

type PlayerLike = {
  bio: string | null
  city: string | null
  playtomicUrl: string | null
  currentLi: number
  preferredCategory: string | null
  preferredFormats: string[] | null
  preferredClubIds: number[] | null
  anyClub: boolean
  lookingForTeam: boolean
}

type Club = { id: number; name: string }

export function ProfileForm({ player, clubs }: { player: PlayerLike; clubs: Club[] }) {
  const [state, action, pending] = useActionState(updateProfile, null)
  const [anyClub, setAnyClub] = useState(player.anyClub)
  const [selectedClubs, setSelectedClubs] = useState<number[]>(player.preferredClubIds ?? [])

  function toggleClub(id: number) {
    setSelectedClubs((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currentLi">League Index (Playtomic, last 6 months)</Label>
          <Input
            id="currentLi"
            name="currentLi"
            type="number"
            step="0.01"
            min="0"
            max="7"
            defaultValue={player.currentLi}
            required
          />
          <p className="text-xs text-muted-foreground">Your highest Playtomic rating in the past 6 months (0–7).</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={player.city ?? ""} placeholder="Pretoria" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="playtomicUrl">Playtomic Profile URL</Label>
        <Input
          id="playtomicUrl"
          name="playtomicUrl"
          defaultValue={player.playtomicUrl ?? ""}
          placeholder="https://playtomic.io/user/..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferredCategory">Preferred Category</Label>
        <select
          id="preferredCategory"
          name="preferredCategory"
          defaultValue={player.preferredCategory ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">No preference</option>
          {CATEGORY_RULES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Formats the player wants to play */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Formats I want to play</legend>
        <p className="text-xs text-muted-foreground">Pick one or both. Your level decides which category you land in.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAYER_FORMATS.map((f) => {
            const checked = (player.preferredFormats ?? []).includes(f.value)
            return (
              <label
                key={f.value}
                className="flex items-start gap-3 rounded-md border border-border bg-secondary px-4 py-3"
              >
                <input
                  type="checkbox"
                  name="preferredFormats"
                  value={f.value}
                  defaultChecked={checked}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm">
                  <span className="font-semibold">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

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
