"use client"

import { useActionState, useState } from "react"
import Image from "next/image"
import { updateProfile } from "@/lib/actions/player"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlayerPhotoUploader } from "@/components/dashboard/player-photo-uploader"
import { toast } from "sonner"

type PlayerLike = {
  firstName: string | null
  lastName: string | null
  bio: string | null
  city: string | null
  playtomicUrl: string | null
  playtomicRating: number | null
  preferredClubIds: number[] | null
  anyClub: boolean
  lookingForTeam: boolean
  avatarUrl?: string | null
}

type Club = { id: number; name: string }

export function ProfileForm({
  player,
  clubs,
  email,
  phone,
  isOnTeam = false,
  isPlayer = false,
}: {
  player: PlayerLike
  clubs: Club[]
  email: string
  phone: string | null
  isOnTeam?: boolean
  isPlayer?: boolean
}) {
  const [state, action, pending] = useActionState(updateProfile, null)
  const [anyClub, setAnyClub] = useState(player.anyClub)
  const [selectedClubs, setSelectedClubs] = useState<number[]>(player.preferredClubIds ?? [])
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl || null)
  // If the player is on a team, marketplace is always off and locked
  const [lookingForTeam, setLookingForTeam] = useState(isOnTeam ? false : player.lookingForTeam)

  function toggleClub(id: number) {
    setSelectedClubs((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function handlePhotoChange(url: string) {
    setAvatarUrl(url)
    toast.success("Photo updated")
  }

  return (
    <form action={action} className="space-y-5">
      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>Profile Photo</Label>
        <div className="flex items-end gap-6">
          <PlayerPhotoUploader
            value={avatarUrl}
            onChange={handlePhotoChange}
          />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Upload a clear photo of yourself. This will appear on your player profile and marketplace listing.
            </p>
          </div>
        </div>
      </div>

      {/* Personal details */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" defaultValue={player.firstName ?? ""} placeholder="First name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Surname</Label>
          <Input id="lastName" name="lastName" defaultValue={player.lastName ?? ""} placeholder="Surname" required />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            disabled
            className="bg-muted/40"
          />
          <p className="text-xs text-muted-foreground">Your sign-in email. Contact the league to change it.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Contact number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            placeholder="e.g. 082 123 4567"
          />
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
          <Label htmlFor="playtomicRating">Playtomic Rating</Label>
          <Input
            id="playtomicRating"
            name="playtomicRating"
            type="number"
            min="0"
            max="7"
            step="0.01"
            defaultValue={player.playtomicRating != null ? String(player.playtomicRating) : ""}
            placeholder="e.g. 3.50"
          />
          <p className="text-xs text-muted-foreground">Your current Playtomic level (0 – 7).</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
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

      {/* Marketplace visibility — locked off when the player already has a team */}
      <div className={`rounded-md border px-4 py-3 ${isOnTeam ? "border-border bg-muted/30 opacity-70" : "border-border bg-secondary"}`}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="lookingForTeam"
            checked={lookingForTeam}
            onChange={(e) => !isOnTeam && setLookingForTeam(e.target.checked)}
            disabled={isOnTeam}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm">
            <span className="font-semibold">List me on the player marketplace</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              {isOnTeam
                ? "You are already on a team — marketplace listing is automatically disabled."
                : "Captains can discover and invite you to their team."}
            </span>
          </span>
        </label>
      </div>

      {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm font-medium text-primary">{state.success}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  )
}
