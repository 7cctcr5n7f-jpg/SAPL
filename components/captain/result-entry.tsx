"use client"

import { useMemo, useState, useTransition } from "react"
import { submitResult, type SubmittedCategory } from "@/lib/actions/captain"
import { tallySets, scoreFixture } from "@/lib/engine/scoring"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { clearResult } from "@/lib/actions/captain"
import { useRouter } from "next/navigation"

type Cat = { category: string; session: number; isFeatureCourt: boolean }
type SetScore = { home: number; away: number }

const MAX_SETS = 3
const EMPTY_SETS: SetScore[] = [
  { home: 0, away: 0 },
  { home: 0, away: 0 },
  { home: 0, away: 0 },
]

function normalizeSets(input?: SetScore[]): SetScore[] {
  const base = input && input.length > 0 ? input.slice(0, MAX_SETS) : []
  const out = [...base]
  while (out.length < MAX_SETS) out.push({ home: 0, away: 0 })
  return out
}

export function ResultEntry({
  fixtureId,
  homeName,
  awayName,
  categories,
  initialScores,
  isEdit,
  onDone,
  allowClear,
}: {
  fixtureId: number
  homeName: string
  awayName: string
  categories: Cat[]
  initialScores?: Record<string, SetScore[]>
  isEdit?: boolean
  onDone?: () => void
  allowClear?: boolean
}) {
  const [pending, start] = useTransition()
  const [clearing, startClearing] = useTransition()
  const router = useRouter()
  const [sets, setSets] = useState<Record<string, SetScore[]>>(
    Object.fromEntries(categories.map((c) => [c.category, normalizeSets(initialScores?.[c.category])])),
  )

  function setGame(cat: string, idx: number, side: "home" | "away", value: number) {
    const nextValue = Number.isFinite(value) ? Math.max(0, Math.min(99, value)) : 0
    setSets((prev) => {
      const rows = prev[cat].map((r, i) => (i === idx ? { ...r, [side]: nextValue } : r))
      return { ...prev, [cat]: rows }
    })
  }

  // Live fixture summary derived from the entered set scores.
  const summary = useMemo(() => {
    const results = categories.map((c) => {
      const t = tallySets(sets[c.category] ?? EMPTY_SETS)
      return {
        category: c.category,
        homeSetsWon: t.homeSetsWon,
        awaySetsWon: t.awaySetsWon,
        splitSets: t.splitSets,
        homeGames: t.homeGames,
        awayGames: t.awayGames,
      }
    })
    return scoreFixture(results)
  }, [sets, categories])

  function submit() {
    const payload: SubmittedCategory[] = categories.map((c) => ({
      category: c.category,
      session: c.session,
      isFeatureCourt: c.isFeatureCourt,
      sets: (sets[c.category] ?? EMPTY_SETS).filter((s) => s.home !== 0 || s.away !== 0),
    }))
    // Block submission if any category has no decisive set yet.
    const incomplete = payload.find((p) => {
      const t = tallySets(p.sets)
      return t.homeSetsWon === 0 && t.awaySetsWon === 0
    })
    if (incomplete) {
      toast.error(`Enter a valid set score for ${incomplete.category}.`)
      return
    }
    start(async () => {
      const res = await submitResult(fixtureId, payload)
      if (res?.error) toast.error(res.error)
      else {
        router.refresh()
        toast.success(res?.success ?? "Submitted")
        onDone?.()
      }
    })
  }

  return (
    <div className="space-y-3 overflow-x-hidden">
      <div className="flex w-full min-w-0 items-center gap-2 rounded-lg bg-secondary px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{homeName}</span>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          vs
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold">{awayName}</span>
      </div>

      <div className="space-y-1.5">
        {categories.map((c) => {
          const rows = sets[c.category] ?? EMPTY_SETS
          const t = tallySets(rows)
          const hw = t.homeSetsWon > t.awaySetsWon
          const aw = t.awaySetsWon > t.homeSetsWon

          return (
            <div key={c.category} className="w-full min-w-0 rounded-md border border-border bg-card">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{c.category}</span>
                  {c.isFeatureCourt && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Feature
                    </Badge>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs">
                  <span className={cn(hw ? "font-bold text-primary" : "text-muted-foreground")}>{t.homeSetsWon}</span>
                  <span className="text-muted-foreground">–</span>
                  <span className={cn(aw ? "font-bold text-primary" : "text-muted-foreground")}>{t.awaySetsWon}</span>
                </span>
              </div>
              
                <div className="border-t border-border px-2.5 py-3 sm:px-3">
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:gap-2">
                    <span>Set 1</span>
                    <span>Set 2</span>
                    <span>Set 3</span>
                  </div>

                  <div className="mt-2">
                    <p className="mb-1 truncate text-xs font-semibold text-foreground">{homeName}</p>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {rows.map((r, i) => (
                        <Input
                          key={`home-${i}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={99}
                          value={r.home === 0 ? "" : r.home}
                          placeholder="0"
                          onChange={(e) => setGame(c.category, i, "home", Number(e.target.value || 0))}
                          className="h-10 min-w-0 px-2 text-center text-base font-semibold tabular-nums"
                          aria-label={`${homeName} games in ${c.category} set ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1 truncate text-xs font-semibold text-foreground">{awayName}</p>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {rows.map((r, i) => (
                        <Input
                          key={`away-${i}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={99}
                          value={r.away === 0 ? "" : r.away}
                          placeholder="0"
                          onChange={(e) => setGame(c.category, i, "away", Number(e.target.value || 0))}
                          className="h-10 min-w-0 px-2 text-center text-base font-semibold tabular-nums"
                          aria-label={`${awayName} games in ${c.category} set ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-1 rounded-md bg-secondary px-3 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Fixture points</span>
          <span className="font-mono text-base font-bold">
            {summary.homePoints} <span className="text-muted-foreground">–</span> {summary.awayPoints}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sets {summary.homeSetsWon}–{summary.awaySetsWon}</span>
          <span>Games {summary.homeGames}–{summary.awayGames}</span>
        </div>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full">
       {pending ? "Saving..." : isEdit ? "Save changes" : "Submit Result"}
      </Button>
      {isEdit && allowClear ? (
       <Button
         type="button"
         variant="outline"
         onClick={() =>
           startClearing(async () => {
             const res = await clearResult(fixtureId)
             if (res?.error) toast.error(res.error)
             else {
               router.refresh()
               toast.success(res.success ?? "Result cleared")
               onDone?.()
             }
           })
         }
         disabled={clearing}
         className="w-full"
       >
         {clearing ? "Clearing..." : "Delete Result"}
       </Button>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
       Enter the actual game score for each set (e.g. 6–4). Standings and TPR update immediately; either
       captain can edit the result later if there&apos;s a mistake.
      </p>
    </div>
  )
}
