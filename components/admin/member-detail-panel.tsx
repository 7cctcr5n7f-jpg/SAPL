"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  getMemberDetail,
  getAssignmentOptions,
  setMemberPermissions,
  setMemberClubAssignment,
  setMemberTeamAssignment,
  type MemberDetail,
} from "@/lib/actions/members"
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS, type Permission } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, X, ShieldCheck, Building2, Users, RotateCcw } from "lucide-react"

type Options = { clubs: { id: number; name: string }[]; teams: { id: number; name: string }[] }

/**
 * Expandable detail panel for a single member: granular permission toggles plus
 * club and team assignment management. Loads its data lazily when first opened.
 */
export function MemberDetailPanel({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const router = useRouter()
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [options, setOptions] = useState<Options | null>(null)
  const [loading, setLoading] = useState(true)
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  async function reload() {
    const [d, o] = await Promise.all([getMemberDetail(userId), getAssignmentOptions()])
    setDetail(d)
    setOptions(o)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (loading || !detail || !options) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading permissions…
      </div>
    )
  }

  const effective = new Set(detail.effectivePermissions)

  function togglePermission(perm: Permission, next: boolean) {
    if (isSelf) {
      toast.error("You can't change your own permissions.")
      return
    }
    // Build the full explicit list from current effective permissions.
    const set = new Set(detail!.effectivePermissions)
    if (next) set.add(perm)
    else set.delete(perm)
    const list = PERMISSIONS.filter((p) => set.has(p))
    setBusy(true)
    startTransition(async () => {
      const res = await setMemberPermissions(userId, list)
      setBusy(false)
      if (res.ok) {
        toast.success(`${PERMISSION_LABELS[perm]} ${next ? "granted" : "revoked"}`)
        await reload()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not update permissions")
      }
    })
  }

  function resetToRoleDefaults() {
    setBusy(true)
    startTransition(async () => {
      const res = await setMemberPermissions(userId, null)
      setBusy(false)
      if (res.ok) {
        toast.success("Reset to role defaults")
        await reload()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not reset")
      }
    })
  }

  function toggleClub(clubId: number, assigned: boolean) {
    setBusy(true)
    startTransition(async () => {
      const res = await setMemberClubAssignment(userId, clubId, assigned)
      setBusy(false)
      if (res.ok) {
        await reload()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not update club assignment")
      }
    })
  }

  function toggleTeam(teamId: number, assigned: boolean) {
    setBusy(true)
    startTransition(async () => {
      const res = await setMemberTeamAssignment(userId, teamId, assigned)
      setBusy(false)
      if (res.ok) {
        await reload()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not update team assignment")
      }
    })
  }

  const assignedClubIds = new Set(detail.clubAssignments.map((c) => c.clubId))
  const assignedTeamIds = new Set(detail.teamAssignments.map((t) => t.teamId))
  const unassignedClubs = options.clubs.filter((c) => !assignedClubIds.has(c.id))
  const unassignedTeams = options.teams.filter((t) => !assignedTeamIds.has(t.id))

  return (
    <div className="grid gap-6 border-t border-border bg-secondary/20 p-4 lg:grid-cols-3">
      {/* Permissions */}
      <section className="lg:col-span-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Assigned Permissions
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {detail.hasOverride ? "Custom override" : "Using role defaults"}
            </span>
            {detail.hasOverride ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={resetToRoleDefaults}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to role
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {PERMISSIONS.map((perm) => {
            const checked = effective.has(perm)
            return (
              <label
                key={perm}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 text-left"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy || isSelf}
                  onChange={(e) => togglePermission(perm, e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary disabled:opacity-50"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{PERMISSION_LABELS[perm]}</span>
                  <span className="block text-xs text-muted-foreground text-pretty">
                    {PERMISSION_DESCRIPTIONS[perm]}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        {isSelf ? (
          <p className="mt-2 text-xs text-muted-foreground">You can&apos;t change your own permissions.</p>
        ) : null}
      </section>

      {/* Clubs */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-primary" /> Assigned Clubs
        </h3>
        <div className="flex flex-col gap-2">
          {detail.clubAssignments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No clubs assigned.</p>
          ) : (
            detail.clubAssignments.map((c) => (
              <div
                key={c.clubId}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-foreground">
                  {c.clubName}
                  {c.auto ? (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      auto
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleClub(c.clubId, false)}
                  className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={`Remove ${c.clubName}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
          {unassignedClubs.length > 0 ? (
            <AddPicker
              label="Add club"
              options={unassignedClubs}
              disabled={busy}
              onAdd={(id) => toggleClub(id, true)}
            />
          ) : null}
        </div>
      </section>

      {/* Teams */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" /> Assigned Teams
        </h3>
        <div className="flex flex-col gap-2">
          {detail.teamAssignments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No teams assigned.</p>
          ) : (
            detail.teamAssignments.map((t) => {
              const auto = t.source !== "manual"
              return (
                <div
                  key={t.teamId}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {t.teamName}
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {t.source}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy || auto}
                    onClick={() => toggleTeam(t.teamId, false)}
                    className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    aria-label={`Remove ${t.teamName}`}
                    title={auto ? "Auto-assigned via owner/captain — can't remove" : "Remove"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })
          )}
          {unassignedTeams.length > 0 ? (
            <AddPicker
              label="Add team"
              options={unassignedTeams}
              disabled={busy}
              onAdd={(id) => toggleTeam(id, true)}
            />
          ) : null}
        </div>
      </section>
    </div>
  )
}

function AddPicker({
  label,
  options,
  disabled,
  onAdd,
}: {
  label: string
  options: { id: number; name: string }[]
  disabled: boolean
  onAdd: (id: number) => void
}) {
  const [value, setValue] = useState("")
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
      >
        <option value="">{label}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled || !value}
        onClick={() => {
          if (!value) return
          onAdd(Number(value))
          setValue("")
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
