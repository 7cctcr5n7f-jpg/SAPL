"use client"

import { useCallback, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  setMemberRole,
  sendMemberResetEmail,
  setMemberTempPassword,
  updateMemberRating,
  updateMemberTeam,
  updateMemberStatus,
  updateMemberDetails,
  updateMemberEmail,
  updateMemberPaid,
  resendInviteEmail,
  deleteMember,
  assignMemberAsTeamOwner,
  createAccountForContact,
  type MemberRow,
  type UnregisteredContact,
} from "@/lib/actions/members"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Mail,
  KeyRound,
  Loader2,
  Pencil,
  UserCircle,
  ChevronDown,
  X,
  Check,
  Send,
  Trash2,
  SquarePen,
  Mars,
  Venus,
  Crown,
  Clock,
  UserPlus,
  Building2,
  Shield,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = MemberRow["role"]
type FilterKey = "region" | "division" | "club" | "team" | "role" | "paymentStatus" | "status"

const ROLES: { value: Role; label: string }[] = [
  { value: "player", label: "Player" },
  { value: "captain", label: "Captain" },
  { value: "org_admin", label: "Club Admin" },
  { value: "super_admin", label: "Main Admin" },
]

const STATUSES: { value: MemberRow["status"]; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
]

const ROLE_BADGE: Record<Role, string> = {
  player: "bg-secondary text-secondary-foreground",
  captain: "bg-sky-100 text-sky-700",
  org_admin: "bg-amber-100 text-amber-700",
  super_admin: "bg-primary/10 text-primary font-semibold",
}

const STATUS_DOT: Record<MemberRow["status"], string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-300",
  suspended: "bg-red-500",
}

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
  outstanding: { label: "Outstanding", cls: "bg-red-100 text-red-700" },
}

const ACCOUNT_BADGE: Record<MemberRow["accountLinked"], { label: string; cls: string }> = {
  linked: { label: "Linked", cls: "text-emerald-600" },
  invited: { label: "Invited", cls: "text-amber-600" },
  not_registered: { label: "Not registered", cls: "text-slate-400" },
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return fmtDate(iso)
}

function roleLabel(r: Role) {
  return ROLES.find((x) => x.value === r)?.label ?? r
}

// ─── Inline-edit cells ──────────────────────────────────────────────────────

function RatingCell({ member, onSaved }: { member: MemberRow; onSaved: (val: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(member.playtomicRating != null ? String(member.playtomicRating) : "")
  const [pending, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep local display in sync when the member prop changes (e.g. after patch)
  const [displayRating, setDisplayRating] = useState(member.playtomicRating)
  if (!editing && member.playtomicRating !== displayRating) {
    setDisplayRating(member.playtomicRating)
  }

  function open() {
    setVal(member.playtomicRating != null ? String(member.playtomicRating) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function save() {
    const n = val.trim() === "" ? null : parseFloat(val)
    if (n !== null && (isNaN(n) || n < 0 || n > 7)) {
      toast.error("Rating must be 0–7")
      return
    }
    start(async () => {
      const res = await updateMemberRating(member.id, n)
      if (res.ok) { setEditing(false); setDisplayRating(n); onSaved(n) }
      else toast.error("Could not save rating")
    })
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") save()
    if (e.key === "Escape") setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={open}
        className="group flex items-center gap-1 rounded px-1.5 py-0.5 text-sm tabular-nums hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title="Click to edit"
      >
        {displayRating != null ? displayRating.toFixed(2) : <span className="text-muted-foreground">—</span>}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        max="7"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey}
        onBlur={save}
        disabled={pending}
        className="w-16 rounded border border-primary bg-background px-1.5 py-0.5 text-sm tabular-nums focus:outline-none"
      />
      {pending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  )
}

function TeamCell({
  member,
  allTeams,
  onSaved,
}: {
  member: MemberRow
  allTeams: { id: number; name: string }[]
  onSaved: (teamId: number | null, teamName: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [search, setSearch] = useState("")
  const [pending, start] = useTransition()
  const [displayTeam, setDisplayTeam] = useState<{ id: number | null; name: string | null }>({
    id: member.teamId ?? null,
    name: member.teamName ?? null,
  })
  // Sync when prop changes externally
  if (!editing && (member.teamId ?? null) !== displayTeam.id) {
    setDisplayTeam({ id: member.teamId ?? null, name: member.teamName ?? null })
  }

  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const options = [{ id: 0, name: "No Team" }, ...allTeams]
    return q ? options.filter((t) => t.name.toLowerCase().includes(q)) : options
  }, [search, allTeams])

  function select(teamId: number, teamName: string) {
    const newId = teamId === 0 ? null : teamId
    const newName = teamId === 0 ? null : teamName
    start(async () => {
      const res = await updateMemberTeam(member.id, newId)
      if (res.ok) {
        setEditing(false)
        setSearch("")
        setDisplayTeam({ id: newId, name: newName })
        onSaved(newId, newName)
      } else {
        toast.error("Could not update team")
      }
    })
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 rounded px-1.5 py-0.5 text-sm hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left max-w-[160px] truncate"
        title={displayTeam.name ?? "No Team"}
      >
        <span className="truncate">{displayTeam.name ?? <span className="text-muted-foreground">No Team</span>}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
      </button>
    )
  }

  return (
    <div ref={ref} className="relative z-20">
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search teams…"
        className="w-44 rounded border border-primary bg-background px-2 py-1 text-sm focus:outline-none"
        onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setSearch("") } }}
      />
      <div className="absolute left-0 top-full mt-1 w-52 max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
        {filtered.slice(0, 20).map((t) => (
          <button
            key={t.id}
            onClick={() => select(t.id, t.name)}
            disabled={pending}
            className={cn(
              "flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted/60 text-left",
              t.id === (member.teamId ?? 0) && "bg-primary/10 font-medium",
            )}
          >
            {pending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            {t.name}
          </button>
        ))}
        {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No teams found</p>}
      </div>
    </div>
  )
}

function RoleCell({ member, isSelf, onSaved }: { member: MemberRow; isSelf: boolean; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  if (isSelf) {
    return (
      <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", ROLE_BADGE[member.role])}>
        {roleLabel(member.role)}
      </span>
    )
  }

  return (
    <select
      value={member.role}
      disabled={pending}
      onChange={(e) => {
        const role = e.target.value as Role
        start(async () => {
          const res = await setMemberRole(member.id, role)
          if (res.ok) { toast.success(`${member.name} is now ${roleLabel(role)}`); onSaved() }
          else toast.error(res.error ?? "Could not update role")
        })
      }}
      className="h-7 rounded border border-input bg-background px-1.5 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  )
}

function StatusCell({ member, isSelf, onSaved }: { member: MemberRow; isSelf: boolean; onSaved: () => void }) {
  const [pending, start] = useTransition()

  if (isSelf) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[member.status])} />
        {member.status}
      </span>
    )
  }

  return (
    <select
      value={member.status}
      disabled={pending}
      onChange={(e) => {
        const status = e.target.value as MemberRow["status"]
        start(async () => {
          const res = await updateMemberStatus(member.id, status)
          if (res.ok) onSaved()
          else toast.error("Could not update status")
        })
      }}
      className="h-7 rounded border border-input bg-background px-1.5 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )
}

function TeamOwnerCell({
  member,
  allTeams,
  onSaved,
}: {
  member: MemberRow
  allTeams: { id: number; name: string; hasOwner: boolean }[]
  onSaved: (ownedTeamId: number | null, ownedTeamName: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [display, setDisplay] = useState<{ id: number | null; name: string | null }>({
    id: member.ownedTeamId ?? null,
    name: member.ownedTeamName ?? null,
  })

  // Sync when prop changes externally
  if (!editing && (member.ownedTeamId ?? null) !== display.id) {
    setDisplay({ id: member.ownedTeamId ?? null, name: member.ownedTeamName ?? null })
  }

  // Only show unowned teams plus the currently owned one
  const options = allTeams.filter((t) => !t.hasOwner || t.id === display.id)

  function select(teamId: number | null) {
    start(async () => {
      const res = await assignMemberAsTeamOwner(member.id, teamId)
      if (res.ok) {
        const name = teamId ? (allTeams.find((t) => t.id === teamId)?.name ?? null) : null
        setDisplay({ id: teamId, name })
        setEditing(false)
        onSaved(teamId, name)
        toast.success(teamId ? `Assigned as owner of ${name}` : "Team ownership cleared")
      } else {
        toast.error(res.error ?? "Could not assign team owner")
      }
    })
  }

  if (pending) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left"
        title={display.name ? `Owner of ${display.name}` : "No owned team — click to assign"}
      >
        {display.name ? (
          <>
            <Crown className="h-3 w-3 shrink-0 text-amber-500" />
            <span className="truncate max-w-[120px]">{display.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">No</span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
      </button>
    )
  }

  return (
    <div className="relative z-20">
      <div className="absolute left-0 top-0 w-52 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
        <button
          onClick={() => select(null)}
          className={cn(
            "flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted/60 text-left text-muted-foreground",
            display.id === null && "bg-primary/10 font-medium text-foreground",
          )}
        >
          No team owner
        </button>
        {options.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground italic">All teams already have owners</p>
        )}
        {options.map((t) => (
          <button
            key={t.id}
            onClick={() => select(t.id)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 text-left",
              t.id === display.id && "bg-primary/10 font-medium",
            )}
          >
            <Crown className="h-3 w-3 shrink-0 text-amber-500" />
            {t.name}
          </button>
        ))}
        <button
          onClick={() => setEditing(false)}
          className="flex w-full items-center gap-1 border-t border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Summary cards ───────────────────────────────────────────────────────────

type StatCard = {
  label: string
  value: number
  filterKey?: FilterKey
  filterValue?: string
  dot?: string
}

function SummaryCards({
  members,
  unregisteredCount,
  activeFilter,
  onFilter,
}: {
  members: MemberRow[]
  unregisteredCount: number
  activeFilter: { key: FilterKey; value: string } | null
  onFilter: (key: FilterKey, value: string) => void
}) {
  const cards: StatCard[] = [
    { label: "Total Members", value: members.length },
    { label: "Assigned to Teams", value: members.filter((m) => m.teamId != null).length, filterKey: "team", filterValue: "__assigned__", dot: "bg-emerald-500" },
    { label: "Unassigned", value: members.filter((m) => m.teamId == null).length, filterKey: "team", filterValue: "__unassigned__", dot: "bg-amber-400" },
    { label: "Paid", value: members.filter((m) => m.paymentStatus === "paid").length, filterKey: "paymentStatus", filterValue: "paid", dot: "bg-emerald-500" },
    { label: "Outstanding", value: members.filter((m) => m.paymentStatus === "outstanding").length, filterKey: "paymentStatus", filterValue: "outstanding", dot: "bg-red-500" },
    { label: "Linked Accounts", value: members.filter((m) => m.accountLinked === "linked").length, filterKey: "status", filterValue: "__linked__", dot: "bg-emerald-500" },
    { label: "Not Registered", value: members.filter((m) => m.accountLinked === "not_registered").length, filterKey: "status", filterValue: "__not_registered__", dot: "bg-slate-300" },
    { label: "Pending Accounts", value: unregisteredCount, dot: "bg-amber-400" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((c) => {
        const isActive = activeFilter != null && activeFilter.key === c.filterKey && activeFilter.value === c.filterValue
        const clickable = c.filterKey != null
        return (
          <button
            key={c.label}
            type="button"
            disabled={!clickable}
            onClick={() => c.filterKey && onFilter(c.filterKey, c.filterValue!)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              clickable ? "cursor-pointer hover:border-primary/40 hover:bg-muted/40" : "cursor-default",
              isActive ? "border-primary bg-primary/5" : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-1.5">
              {c.dot && <span className={cn("h-2 w-2 rounded-full shrink-0", c.dot)} />}
              <span className="text-xs text-muted-foreground leading-tight">{c.label}</span>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{c.value}</div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function uniq(arr: (string | null)[]): string[] {
  return [...new Set(arr.filter(Boolean) as string[])].sort()
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  if (options.length === 0) return null
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── Member edit slide-out panel ─────────────────────────────────────────────

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
]

const PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
  "Limpopo", "Mpumalanga", "North West", "Free State", "Northern Cape",
]

function MemberEditPanel({
  member,
  onClose,
  onSaved,
  onDeleted,
}: {
  member: MemberRow
  onClose: () => void
  onSaved: (updates: Partial<MemberRow>) => void
  onDeleted: () => void
}) {
  const [pending, start] = useTransition()
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Field state
  const [firstName, setFirstName] = useState(member.playerName?.split(" ")[0] ?? member.name.split(" ")[0] ?? "")
  const [lastName, setLastName] = useState(member.playerName?.split(" ").slice(1).join(" ") ?? member.name.split(" ").slice(1).join(" ") ?? "")
  const [email, setEmail] = useState(member.email)
  const [phone, setPhone] = useState(member.phone ?? "")
  const [gender, setGender] = useState(member.gender ?? "")
  const [city, setCity] = useState(member.city ?? "")
  const [province, setProvince] = useState(member.province ?? "")
  const [li, setLi] = useState(member.currentLi != null ? String(member.currentLi) : "")
  const [rating, setRating] = useState(member.playtomicRating != null ? String(member.playtomicRating) : "")
  const [playtomicUrl, setPlaytomicUrl] = useState(member.playtomicUrl ?? "")
  const [paid, setPaid] = useState(member.paymentStatus === "paid")

  function save() {
    start(async () => {
      const liVal = li.trim() === "" ? null : parseInt(li, 10)
      const ratingVal = rating.trim() === "" ? null : parseFloat(rating)

      if (liVal !== null && (isNaN(liVal) || liVal < 0)) { toast.error("LI must be a positive number"); return }
      if (ratingVal !== null && (isNaN(ratingVal) || ratingVal < 0 || ratingVal > 7)) { toast.error("Rating must be 0–7"); return }

      // Email change is separate (security check)
      const emailTrimmed = email.trim().toLowerCase()
      if (emailTrimmed !== member.email) {
        const res = await updateMemberEmail(member.id, emailTrimmed)
        if (!res.ok) { toast.error(res.error ?? "Could not update email"); return }
      }

      // Core profile update
      const res = await updateMemberDetails(member.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone.trim() || null,
        gender: gender || null,
        city: city.trim() || null,
        province: province || null,
        currentLi: liVal,
        playtomicRating: ratingVal,
        playtomicUrl: playtomicUrl.trim() || null,
      })
      if (!res.ok) { toast.error(res.error ?? "Could not save"); return }

      // Payment status
      if ((member.paymentStatus === "paid") !== paid) {
        const pRes = await updateMemberPaid(member.id, paid)
        if (!pRes.ok) { toast.error(pRes.error ?? "Could not update payment status"); return }
      }

      toast.success("Member updated")
      const newName = `${firstName.trim()} ${lastName.trim()}`.trim()
      onSaved({
        name: newName,
        playerName: newName,
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        gender: gender || null,
        city: city.trim() || null,
        playtomicRating: ratingVal,
        playtomicUrl: playtomicUrl.trim() || null,
        paymentStatus: paid ? "paid" : "outstanding",
      })
      onClose()
    })
  }

  function handleResendInvite() {
    start(async () => {
      const res = await resendInviteEmail(member.id)
      if (res.ok) toast.success("Invite email resent")
      else toast.error(res.error ?? "Could not resend invite")
    })
  }

  function handleResetEmail() {
    start(async () => {
      const res = await sendMemberResetEmail(member.id)
      if (res.ok) toast.success(`Password reset sent to ${member.email}`)
      else toast.error(res.error ?? "Could not send reset email")
    })
  }

  function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    start(async () => {
      const res = await deleteMember(member.id)
      if (res.ok) { toast.success("Member deleted"); onDeleted(); onClose() }
      else toast.error(res.error ?? "Could not delete member")
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatarUrl} alt={member.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground leading-tight">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email Address</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-8 text-sm" />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mobile Number</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="h-8 text-sm" />
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Not specified</option>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          {/* City + Province */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Province</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select…</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* LI + PT Rating */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">League Index (LI)</label>
              <Input
                value={li}
                onChange={(e) => setLi(e.target.value)}
                type="number"
                min="0"
                step="1"
                className="h-8 text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Playtomic Rating</label>
              <Input
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                type="number"
                min="0"
                max="7"
                step="0.01"
                className="h-8 text-sm tabular-nums"
              />
            </div>
          </div>

          {/* Playtomic URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Playtomic Profile URL</label>
            <Input value={playtomicUrl} onChange={(e) => setPlaytomicUrl(e.target.value)} type="url" className="h-8 text-sm" placeholder="https://playtomic.io/..." />
          </div>

          {/* Paid status */}
          <label className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-medium text-foreground">Mark as Paid</span>
            <span className={cn(
              "ml-auto rounded px-2 py-0.5 text-[11px] font-medium",
              paid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
            )}>
              {paid ? "Paid" : "Outstanding"}
            </span>
          </label>

          {/* Account actions */}
          <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Account Actions</p>

            {member.accountLinked === "invited" && (
              <button
                type="button"
                disabled={pending}
                onClick={handleResendInvite}
                className="flex w-full items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Resend invite email</span>
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={handleResetEmail}
              className="flex w-full items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span>Send password reset email</span>
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50",
                deleteConfirm
                  ? "border-red-400 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-border bg-card text-destructive hover:bg-muted/50",
              )}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span>{deleteConfirm ? "Confirm delete — this cannot be undone" : "Delete account"}</span>
            </button>
            {deleteConfirm && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MembersTable({
  members: initialMembers,
  allTeams,
  currentUserId,
  unregisteredContacts: initialUnregistered = [],
}: {
  members: MemberRow[]
  allTeams: { id: number; name: string; hasOwner: boolean }[]
  currentUserId: string
  unregisteredContacts?: UnregisteredContact[]
}) {
  const router = useRouter()
  const [members, setMembers] = useState<MemberRow[]>(initialMembers)
  const [unregistered, setUnregistered] = useState<UnregisteredContact[]>(initialUnregistered)
  const [completingContact, setCompletingContact] = useState<UnregisteredContact | null>(null)
  const [query, setQuery] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pwModal, setPwModal] = useState<{ name: string; email: string; password: string } | null>(null)
  const [editMember, setEditMember] = useState<MemberRow | null>(null)
  const [, startTransition] = useTransition()

  // Filters
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({})
  const [summaryFilter, setSummaryFilter] = useState<{ key: FilterKey; value: string } | null>(null)

  function refresh() { router.refresh() }

  // Optimistic update helper
  function patch(id: string, update: Partial<MemberRow>) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...update } : m))
  }

  // Filter options derived from data
  const filterOptions = useMemo(() => ({
    region: uniq(members.map((m) => m.regionName)),
    division: uniq(members.map((m) => m.divisionName)),
    club: uniq(members.map((m) => m.clubName)),
    team: uniq(members.map((m) => m.teamName)),
    role: uniq(members.map((m) => roleLabel(m.role))),
    paymentStatus: ["Paid", "Pending", "Outstanding"],
    status: ["Active", "Inactive", "Suspended"],
  }), [members])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return members.filter((m) => {
      // Quick search
      if (q) {
        const haystack = [m.name, m.email, m.phone ?? "", m.teamName ?? ""].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      // Summary card filter
      if (summaryFilter) {
        const { key, value } = summaryFilter
        if (key === "team") {
          if (value === "__assigned__" && m.teamId == null) return false
          if (value === "__unassigned__" && m.teamId != null) return false
        } else if (key === "paymentStatus") {
          if (m.paymentStatus !== value) return false
        } else if (key === "status") {
          if (value === "__linked__" && m.accountLinked !== "linked") return false
          if (value === "__not_registered__" && m.accountLinked !== "not_registered") return false
        }
      }
      // Dropdown filters
      if (filters.region && m.regionName !== filters.region) return false
      if (filters.division && m.divisionName !== filters.division) return false
      if (filters.club && m.clubName !== filters.club) return false
      if (filters.team && m.teamName !== filters.team) return false
      if (filters.role && roleLabel(m.role) !== filters.role) return false
      if (filters.paymentStatus) {
        const map: Record<string, string> = { Paid: "paid", Pending: "pending", Outstanding: "outstanding" }
        if (m.paymentStatus !== (map[filters.paymentStatus] ?? "")) return false
      }
      if (filters.status) {
        const map: Record<string, string> = { Active: "active", Inactive: "inactive", Suspended: "suspended" }
        if (m.status !== (map[filters.status] ?? "")) return false
      }
      return true
    })
  }, [members, query, filters, summaryFilter])

  function handleSummaryFilter(key: FilterKey, value: string) {
    setSummaryFilter((prev) => (prev?.key === key && prev.value === value ? null : { key, value }))
  }

  function clearFilters() {
    setFilters({})
    setSummaryFilter(null)
    setQuery("")
  }

  const hasFilters = query || summaryFilter || Object.values(filters).some(Boolean)

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
      if (res.ok && res.password) setPwModal({ name: m.name, email: m.email, password: res.password })
      else toast.error(res.error ?? "Could not set password")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <SummaryCards members={members} unregisteredCount={unregistered.length} activeFilter={summaryFilter} onFilter={handleSummaryFilter} />

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, team…"
            className="h-8 w-64 pr-7 text-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <FilterSelect label="Region" value={filters.region ?? ""} options={filterOptions.region} onChange={(v) => setFilters((f) => ({ ...f, region: v || undefined }))} />
        <FilterSelect label="Division" value={filters.division ?? ""} options={filterOptions.division} onChange={(v) => setFilters((f) => ({ ...f, division: v || undefined }))} />
        <FilterSelect label="Club" value={filters.club ?? ""} options={filterOptions.club} onChange={(v) => setFilters((f) => ({ ...f, club: v || undefined }))} />
        <FilterSelect label="Team" value={filters.team ?? ""} options={filterOptions.team} onChange={(v) => setFilters((f) => ({ ...f, team: v || undefined }))} />
        <FilterSelect label="Role" value={filters.role ?? ""} options={filterOptions.role} onChange={(v) => setFilters((f) => ({ ...f, role: v || undefined }))} />
        <FilterSelect label="Payment" value={filters.paymentStatus ?? ""} options={filterOptions.paymentStatus} onChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v || undefined }))} />
        <FilterSelect label="Status" value={filters.status ?? ""} options={filterOptions.status} onChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))} />

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            <X className="h-3 w-3" /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {members.length}
        </span>
      </div>

      {/* Table: Name, Role, Team, PT Rating, Payment + Edit */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 w-8" />
              <th className="px-3 py-2.5 min-w-[180px]">Name</th>
              <th className="px-3 py-2.5 min-w-[130px]">Role</th>
              <th className="px-3 py-2.5 min-w-[160px]">Team</th>
              <th className="px-3 py-2.5 min-w-[140px]">Team owner</th>
              <th className="px-3 py-2.5 w-20">Gender</th>
              <th className="px-3 py-2.5 min-w-[90px] text-right">PT Rating</th>
              <th className="px-3 py-2.5 min-w-[100px]">Payment</th>
              <th className="px-3 py-2.5 min-w-[100px]">Last log</th>
              <th className="px-3 py-2.5 w-16 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const isSelf = m.id === currentUserId
              const payment = m.paymentStatus ? PAYMENT_BADGE[m.paymentStatus] : null

              return (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Avatar */}
                  <td className="px-3 py-2.5">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt={m.name} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground leading-tight">
                      {m.name}
                      {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}
                    </div>
                    {m.playerName && m.playerName !== m.name && (
                      <div className="text-[11px] text-muted-foreground leading-tight">{m.playerName}</div>
                    )}
                  </td>

                  {/* Role — inline select */}
                  <td className="px-3 py-2.5">
                    <RoleCell member={m} isSelf={isSelf} onSaved={() => { patch(m.id, {}); refresh() }} />
                  </td>

                  {/* Team — inline searchable dropdown */}
                  <td className="px-3 py-2.5">
                    <TeamCell
                      member={m}
                      allTeams={allTeams}
                      onSaved={(teamId, teamName) => patch(m.id, { teamId: teamId ?? undefined, teamName: teamName ?? undefined })}
                    />
                  </td>

                  {/* Team owner — inline dropdown */}
                  <td className="px-3 py-2.5">
                    <TeamOwnerCell
                      member={m}
                      allTeams={allTeams}
                      onSaved={(ownedTeamId, ownedTeamName) => patch(m.id, { ownedTeamId: ownedTeamId ?? undefined, ownedTeamName: ownedTeamName ?? undefined })}
                    />
                  </td>

                  {/* Gender */}
                  <td className="px-3 py-2.5">
                    {m.gender === "male" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                        <Mars className="h-3.5 w-3.5 shrink-0" /> M
                      </span>
                    ) : m.gender === "female" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-pink-500">
                        <Venus className="h-3.5 w-3.5 shrink-0" /> F
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* PT Rating — inline editable */}
                  <td className="px-3 py-2.5 text-right">
                    <RatingCell
                      member={m}
                      onSaved={(val) => patch(m.id, { playtomicRating: val })}
                    />
                  </td>

                  {/* Payment status */}
                  <td className="px-3 py-2.5">
                    {payment ? (
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", payment.cls)}>{payment.label}</span>
                    ) : (
                      <span className="text-xs text-border">—</span>
                    )}
                  </td>

                  {/* Last log */}
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title={m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString("en-ZA") : "Never logged in"}
                    >
                      <Clock className="h-3 w-3 shrink-0" />
                      {fmtRelative(m.lastLoginAt)}
                    </span>
                  </td>

                  {/* Edit button */}
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditMember(m)}
                      title="Edit member"
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                  {hasFilters ? "No members match the current filters." : "No members yet."}
                </td>
              </tr>
            )}

            {/* ── Unregistered / pending contacts ─────────────────────────── */}
            {unregistered.length > 0 && !summaryFilter && !Object.values(filters).some(Boolean) && (
              <>
                <tr>
                  <td colSpan={10} className="px-3 pt-6 pb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                      <UserPlus className="h-3.5 w-3.5" />
                      Pending accounts — email on file, no account yet
                    </div>
                  </td>
                </tr>
                {unregistered.map((c) => (
                  <tr key={c.key} className="border-b border-border/40 bg-amber-50/30 dark:bg-amber-950/10 opacity-80 hover:opacity-100 transition-opacity">
                    {/* avatar placeholder */}
                    <td className="px-3 py-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                        <UserPlus className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                    </td>
                    {/* name / email */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground/80">
                          {c.name ?? <span className="italic text-muted-foreground">No name</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.email}</span>
                      </div>
                    </td>
                    {/* role — n/a */}
                    <td className="px-3 py-2.5">
                      <span className="rounded px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        No account
                      </span>
                    </td>
                    {/* team */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                    {/* team owner */}
                    <td className="px-3 py-2.5">
                      {c.ownedTeamId ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Crown className="h-3 w-3 text-amber-500" />
                          {c.ownedTeamName}
                        </span>
                      ) : c.clubName ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {c.clubName}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    {/* gender */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                    {/* PT Rating */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground text-right">—</td>
                    {/* payment */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                    {/* last log */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">Never</td>
                    {/* complete account button */}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        title="Complete account"
                        onClick={() => setCompletingContact(c)}
                        className="rounded p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 transition-colors"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Temp password modal */}
      {pwModal && <TempPasswordModal data={pwModal} onClose={() => setPwModal(null)} />}

      {/* Complete account dialog for unregistered contacts */}
      {completingContact && (
        <CompleteAccountDialog
          contact={completingContact}
          onClose={() => setCompletingContact(null)}
          onCreated={(password) => {
            setPwModal({ name: completingContact.name ?? completingContact.email, email: completingContact.email, password })
            setUnregistered((prev) => prev.filter((c) => c.key !== completingContact.key))
            setCompletingContact(null)
          }}
        />
      )}

      {/* Member edit panel */}
      {editMember && (
        <MemberEditPanel
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={(updates) => {
            patch(editMember.id, updates)
            setEditMember((prev) => prev ? { ...prev, ...updates } : prev)
          }}
          onDeleted={() => { setMembers((prev) => prev.filter((m) => m.id !== editMember.id)) }}
        />
      )}
    </div>
  )
}

// ─── Complete account dialog ──────────────────────────────────────────────────

const ROLE_OPTIONS: { value: MemberRow["role"]; label: string }[] = [
  { value: "org_admin", label: "Club Admin" },
  { value: "captain", label: "Captain" },
  { value: "player", label: "Player" },
  { value: "super_admin", label: "Main Admin" },
]

function CompleteAccountDialog({
  contact,
  onClose,
  onCreated,
}: {
  contact: UnregisteredContact
  onClose: () => void
  onCreated: (password: string) => void
}) {
  const [name, setName] = useState(contact.name ?? "")
  const [phone, setPhone] = useState(contact.phone ?? "")
  const [role, setRole] = useState<MemberRow["role"]>("org_admin")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await createAccountForContact({ name, email: contact.email, phone: phone || null, role })
      if (res.ok && res.password) {
        onCreated(res.password)
      } else {
        setError(res.error ?? "Could not create account")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Complete account</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{contact.email}</p>
            {contact.ownedTeamName && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <Crown className="h-3 w-3" /> Team owner of {contact.ownedTeamName}
              </p>
            )}
            {contact.clubName && !contact.ownedTeamName && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> Contact for {contact.clubName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Full name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First Last" required className="h-9 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Contact number</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 82 000 0000" type="tel" className="h-9 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRow["role"])}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Temp password modal ─────────────────────────────────────────────────────

function TempPasswordModal({
  data,
  onClose,
}: {
  data: { name: string; email: string; password: string }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(data.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">Temporary password set</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{data.name} · {data.email}</p>
          </div>
          <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
          <code className="flex-1 font-mono text-sm">{data.password}</code>
          <button onClick={copy} className="text-muted-foreground hover:text-foreground" title="Copy">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <KeyRound className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Share this password securely. The member should change it on first login.</p>
        <Button className="mt-4 w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
