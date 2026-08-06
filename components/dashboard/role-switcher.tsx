"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { listViewAsMembers, setActingMember } from "@/lib/actions/view-as"
import { cn } from "@/lib/utils"
import { Eye, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

type MemberOption = { userId: string; label: string; role: string; hint: string }

export function RoleSwitcher({ actingRole, actingUserId }: { actingRole: string | null; actingUserId?: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loadedMembers, setLoadedMembers] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const impersonating = Boolean(actingUserId || actingRole)
  const selectedMember = actingUserId ? members.find((member) => member.userId === actingUserId) ?? null : null
  const filteredMembers = members.filter((member) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return member.label.toLowerCase().includes(q) || member.hint.toLowerCase().includes(q)
  })

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function ensureMembers() {
    if (loadedMembers) return
    const rows = await listViewAsMembers()
    setMembers(rows)
    setLoadedMembers(true)
  }

  function chooseMember(userId: string | "self") {
    setOpen(false)
    startTransition(async () => {
      await setActingMember(userId)
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          void ensureMembers()
        }}
        disabled={pending}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
          impersonating
            ? "border-primary/60 bg-primary/10 text-sidebar-foreground"
            : "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 truncate">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Viewing as</span>
            <span className="font-semibold">{selectedMember?.label ?? "Main Admin"}</span>
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          <div className="px-2 pb-2 pt-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search member..."
              className="h-9"
            />
          </div>
          <button
            type="button"
            onClick={() => chooseMember("self")}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
              !actingUserId ? "bg-secondary" : "hover:bg-secondary/60",
            )}
          >
            <span className="flex flex-col leading-tight">
              <span className="font-medium text-popover-foreground">Main Admin</span>
              <span className="text-xs text-muted-foreground">Return to your own account</span>
            </span>
            {!actingUserId && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
          <div className="max-h-72 overflow-y-auto">
            {filteredMembers.map((member) => {
              const selected = actingUserId === member.userId
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => chooseMember(member.userId)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
                    selected ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate font-medium text-popover-foreground">{member.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{member.hint}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })}
            {filteredMembers.length === 0 ? (
              <div className="px-2.5 py-3 text-sm text-muted-foreground">No members match that search.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
