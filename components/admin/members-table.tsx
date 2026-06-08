"use client"

import { Fragment, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  setMemberRole,
  sendMemberResetEmail,
  setMemberTempPassword,
  createMember,
  type MemberRow,
} from "@/lib/actions/members"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Mail, KeyRound, Loader2, Copy, Check, X, UserPlus, ChevronDown, SlidersHorizontal } from "lucide-react"
import { MemberDetailPanel } from "@/components/admin/member-detail-panel"

type Role = MemberRow["role"]

const ROLES: { value: Role; label: string }[] = [
  { value: "player", label: "Player" },
  { value: "captain", label: "Captain" },
  { value: "org_admin", label: "Club Admin" },
  { value: "league_admin", label: "League Admin" },
  { value: "super_admin", label: "Main Admin" },
]

const ROLE_BADGE: Record<Role, string> = {
  player: "bg-secondary text-secondary-foreground",
  captain: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  org_admin: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  league_admin: "bg-primary/15 text-primary",
  super_admin: "bg-primary text-primary-foreground",
}

const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
}

export function MembersTable({ members, currentUserId }: { members: MemberRow[]; currentUserId: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [pwModal, setPwModal] = useState<{ name: string; email: string; password: string } | null>(null)

  const filtered = members.filter((m) => {
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  function changeRole(m: MemberRow, role: Role) {
    if (role === m.role) return
    setPendingId(m.id)
    startTransition(async () => {
      const res = await setMemberRole(m.id, role)
      setPendingId(null)
      if (res.ok) {
        toast.success(`${m.name} is now ${roleLabel(role)}`)
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not update role")
      }
    })
  }

  function emailReset(m: MemberRow) {
    setPendingId(m.id)
    startTransition(async () => {
      const res = await sendMemberResetEmail(m.id)
      setPendingId(null)
      if (res.ok) toast.success(`Reset link sent to ${m.email}`)
      else toast.error(res.error ?? "Could not send reset email")
    })
  }

  function tempPassword(m: MemberRow) {
    setPendingId(m.id)
    startTransition(async () => {
      const res = await setMemberTempPassword(m.id)
      setPendingId(null)
      if (res.ok && res.password) {
        setPwModal({ name: m.name, email: m.email, password: res.password })
      } else {
        toast.error(res.error ?? "Could not set password")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="sm:max-w-sm"
        />
        <AddMemberDialog onCreated={(data) => setPwModal(data)} />
      </div>

      {/* Mobile / tablet: stacked cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {filtered.map((m) => {
          const isSelf = m.id === currentUserId
          const busy = pendingId === m.id
          return (
            <div key={m.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">
                    {m.name}
                    {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  {m.playerName && m.playerName !== m.name ? (
                    <div className="truncate text-xs text-muted-foreground">Player: {m.playerName}</div>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(m.createdAt)}</span>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
                {isSelf ? (
                  <span
                    className={cn(
                      "inline-block rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide",
                      ROLE_BADGE[m.role],
                    )}
                  >
                    {roleLabel(m.role)}
                  </span>
                ) : (
                  <select
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => emailReset(m)}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Email reset</span>
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => tempPassword(m)}>
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="ml-1.5">Temp password</span>
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background py-2 text-xs font-medium text-foreground"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Permissions &amp; assignments
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", expandedId === m.id && "rotate-180")}
                />
              </button>
              {expandedId === m.id ? (
                <div className="mt-3 -mx-4 -mb-4 overflow-hidden rounded-b-lg">
                  <MemberDetailPanel userId={m.id} isSelf={isSelf} />
                </div>
              ) : null}
            </div>
          )
        })}
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-muted-foreground">
            No members match &ldquo;{query}&rdquo;.
          </p>
        ) : null}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="px-4 py-3 font-semibold">Member</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 text-right font-semibold">Password</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const isSelf = m.id === currentUserId
              const busy = pendingId === m.id
              const expanded = expandedId === m.id
              return (
                <Fragment key={m.id}>
                <tr className="border-b border-border last:border-0 data-[expanded=true]:border-0" data-expanded={expanded}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {m.name}
                      {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                    {m.playerName && m.playerName !== m.name ? (
                      <div className="text-xs text-muted-foreground">Player: {m.playerName}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span
                        className={cn(
                          "inline-block rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide",
                          ROLE_BADGE[m.role],
                        )}
                      >
                        {roleLabel(m.role)}
                      </span>
                    ) : (
                      <select
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => changeRole(m, e.target.value as Role)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => emailReset(m)}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">Email reset</span>
                      </Button>
                      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => tempPassword(m)}>
                        <KeyRound className="h-3.5 w-3.5" />
                        <span className="ml-1.5">Temp password</span>
                      </Button>
                      <Button
                        type="button"
                        variant={expanded ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setExpandedId(expanded ? null : m.id)}
                        aria-label="Permissions and assignments"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-border last:border-0">
                    <td colSpan={4} className="p-0">
                      <MemberDetailPanel userId={m.id} isSelf={isSelf} />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              )
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No members match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pwModal ? <TempPasswordModal data={pwModal} onClose={() => setPwModal(null)} /> : null}
    </div>
  )
}

function AddMemberDialog({
  onCreated,
}: {
  onCreated: (data: { name: string; email: string; password: string }) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("player")

  function reset() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setRole("player")
  }

  function submit() {
    if (!firstName.trim() || !email.trim()) {
      toast.error("First name and email are required.")
      return
    }
    startTransition(async () => {
      const res = await createMember({ firstName, lastName, email, role })
      if (res.ok && res.password) {
        toast.success(`${firstName} added as ${roleLabel(role)}`)
        onCreated({ name: `${firstName} ${lastName}`.trim(), email: email.trim().toLowerCase(), password: res.password })
        setOpen(false)
        reset()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not create member")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button type="button">
            <UserPlus className="mr-1.5 h-4 w-4" /> Add member
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              A temporary password is generated automatically. You can share it after creating the member.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TempPasswordModal({
  data,
  onClose,
}: {
  data: { name: string; email: string; password: string }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(data.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="heading text-xl text-foreground">Temporary password set</h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Share this with <span className="text-foreground">{data.name}</span> ({data.email}). They should change it
              after signing in.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-background p-3">
          <code className="flex-1 break-all font-mono text-base text-foreground">{data.password}</code>
          <Button type="button" size="sm" variant="secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          This password is shown once. If you lose it, just generate a new one.
        </p>

        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
