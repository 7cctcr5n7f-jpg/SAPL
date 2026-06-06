"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { setActingRole } from "@/lib/actions/view-as"
import { cn } from "@/lib/utils"
import { Eye, Check, ChevronsUpDown, Loader2 } from "lucide-react"

type Option = { value: "self" | "league_admin" | "org_admin" | "captain" | "player"; label: string; hint: string }

const OPTIONS: Option[] = [
  { value: "self", label: "Main Admin", hint: "Full control" },
  { value: "league_admin", label: "League Admin", hint: "Run the season" },
  { value: "org_admin", label: "Club Admin", hint: "Manage a club" },
  { value: "captain", label: "Captain", hint: "Run a team" },
  { value: "player", label: "Player", hint: "Compete" },
]

export function RoleSwitcher({ actingRole }: { actingRole: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  const currentValue = actingRole ?? "self"
  const current = OPTIONS.find((o) => o.value === currentValue) ?? OPTIONS[0]
  const impersonating = currentValue !== "self"

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function choose(value: Option["value"]) {
    setOpen(false)
    if (value === currentValue) return
    startTransition(async () => {
      await setActingRole(value)
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
            <span className="font-semibold">{current.label}</span>
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {OPTIONS.map((o) => {
            const selected = o.value === currentValue
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
                  selected ? "bg-secondary" : "hover:bg-secondary/60",
                )}
              >
                <span className="flex flex-col leading-tight">
                  <span className="font-medium text-popover-foreground">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
