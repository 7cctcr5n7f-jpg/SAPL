"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { createPlayerAccount } from "@/lib/actions/members"
import { toast } from "sonner"
import { UserPlus, Copy, Check } from "lucide-react"
import { useRouter } from "next/navigation"

/**
 * Shared "Add player" dialog used by both the Team Admin hub and the Captain
 * hub. Captains and club admins create a player account here; the new player
 * can optionally be dropped straight onto one of the creator's own teams,
 * otherwise they join as a free agent. League Index, province, city and
 * preferred category are intentionally omitted — those are set later by the
 * player or by a league admin under Player Management.
 */
export function AddPlayerDialog({
  teams,
  triggerLabel = "Add player",
  triggerVariant = "default",
}: {
  teams: { id: number; name: string }[]
  triggerLabel?: string
  triggerVariant?: "default" | "outline" | "secondary"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("male")
  const [playtomicUrl, setPlaytomicUrl] = useState("")
  const [bio, setBio] = useState("")
  const [assignTeamId, setAssignTeamId] = useState("")
  const [created, setCreated] = useState<{ name: string; email: string; password: string; team: string | null } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  function reset() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setGender("male")
    setPlaytomicUrl("")
    setBio("")
    setAssignTeamId("")
  }

  function submit() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name and email are required.")
      return
    }
    start(async () => {
      const res = await createPlayerAccount({
        firstName,
        lastName,
        email,
        phone: phone.trim() || null,
        gender,
        playtomicUrl: playtomicUrl.trim() || null,
        bio: bio.trim() || null,
        assignTeamId: assignTeamId ? Number(assignTeamId) : null,
      })
      if (res.ok && res.password) {
        toast.success(
          res.assignedTeamName ? `${firstName} ${lastName} added to ${res.assignedTeamName}` : `${firstName} ${lastName} added`,
        )
        setCreated({
          name: `${firstName} ${lastName}`,
          email: email.trim().toLowerCase(),
          password: res.password,
          team: res.assignedTeamName ?? null,
        })
        setOpen(false)
        reset()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not add player")
      }
    })
  }

  async function copy() {
    if (!created) return
    await navigator.clipboard.writeText(created.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm"

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
      >
        <DialogTrigger
          render={
            <Button size="sm" variant={triggerVariant}>
              <UserPlus className="mr-1.5 h-4 w-4" /> {triggerLabel}
            </Button>
          }
        />
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a player</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Identity */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pFirst">First name</Label>
                  <Input id="pFirst" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pLast">Last name</Label>
                  <Input id="pLast" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pEmail">Email</Label>
                  <Input
                    id="pEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pPhone">Contact number</Label>
                  <Input
                    id="pPhone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="082 123 4567"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pGender">Gender</Label>
                  <select
                    id="pGender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={selectClass}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pPlay">Playtomic URL (optional)</Label>
                  <Input
                    id="pPlay"
                    value={playtomicUrl}
                    onChange={(e) => setPlaytomicUrl(e.target.value)}
                    placeholder="https://playtomic.io/…"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pBio">Bio (optional)</Label>
                <Textarea
                  id="pBio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short note about this player…"
                  rows={2}
                />
              </div>
            </div>

            {/* Team assignment */}
            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="pTeam">Assign to a team</Label>
              <select
                id="pTeam"
                value={assignTeamId}
                onChange={(e) => setAssignTeamId(e.target.value)}
                className={selectClass}
              >
                <option value="">Free agent (no team yet)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Pick one of your teams to add the player straight to its roster, or leave as a free agent.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              A temporary password is generated automatically — you can share it after creating the player. League
              Index and other profile details are set later.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Adding…" : "Add player"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Player account created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-pretty">
            Share these sign-in details with <span className="text-foreground">{created?.name}</span> (
            {created?.email}). They should change the password after signing in.
            {created?.team ? (
              <>
                {" "}
                Added to <span className="text-foreground">{created.team}</span>.
              </>
            ) : null}
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background p-3">
            <code className="flex-1 break-all font-mono text-base text-foreground">{created?.password}</code>
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
