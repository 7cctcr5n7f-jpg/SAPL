"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { RotateCcw, RefreshCw, Sparkles, Loader2 } from "lucide-react"
import { resetDemoData, refreshDemoRankings } from "@/app/admin/demo/actions"

type Action = "reset" | "regenerate" | "refresh"

const CONFIG: Record<
  Action,
  { title: string; desc: string; confirm: string; danger: boolean; icon: typeof RotateCcw }
> = {
  reset: {
    title: "Reset demo data",
    desc: "This wipes ALL demo data and rebuilds a fresh synthetic league with the standard demo logins. Anything testers changed will be lost. Production is never touched.",
    confirm: "Reset everything",
    danger: true,
    icon: RotateCcw,
  },
  regenerate: {
    title: "Regenerate league",
    desc: "Wipes the current demo league and generates a brand-new set of clubs, teams, players, fixtures and standings. Demo logins are recreated.",
    confirm: "Regenerate league",
    danger: true,
    icon: Sparkles,
  },
  refresh: {
    title: "Refresh rankings",
    desc: "Recomputes cached team aggregates (average League Index, roster counts) and re-syncs regions across every demo team. Non-destructive.",
    confirm: "Refresh now",
    danger: false,
    icon: RefreshCw,
  },
}

export function DemoControls() {
  const [open, setOpen] = useState<Action | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: Action) {
    startTransition(async () => {
      if (action === "refresh") {
        const res = await refreshDemoRankings()
        if (res.ok) toast.success(`Rankings refreshed across ${res.teams} teams.`)
        else toast.error(res.error)
      } else {
        const res = await resetDemoData()
        if (res.ok) {
          const s = res.summary
          toast.success(
            `Demo rebuilt: ${s.organisations ?? "?"} clubs, ${s.teams ?? "?"} teams, ${s.demoUsers} logins.`,
          )
        } else {
          toast.error(res.error)
        }
      }
      setOpen(null)
    })
  }

  const cards: Action[] = ["reset", "regenerate", "refresh"]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((action) => {
        const cfg = CONFIG[action]
        const Icon = cfg.icon
        return (
          <Dialog key={action} open={open === action} onOpenChange={(v) => setOpen(v ? action : null)}>
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50"
                />
              }
            >
              <span
                className={`flex size-10 items-center justify-center rounded-lg ${
                  cfg.danger ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
                }`}
              >
                <Icon className="size-5" />
              </span>
              <span className="font-semibold">{cfg.title}</span>
              <span className="text-sm text-muted-foreground leading-relaxed">{cfg.desc}</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{cfg.title}</DialogTitle>
                <DialogDescription className="leading-relaxed">{cfg.desc}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  variant={cfg.danger ? "destructive" : "default"}
                  onClick={() => run(action)}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {cfg.confirm}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })}
    </div>
  )
}
