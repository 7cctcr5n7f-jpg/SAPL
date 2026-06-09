"use client"

import { useMemo, useState, useTransition } from "react"
import { submitResult, type SubmittedCategory } from "@/lib/actions/captain"
import { tallySets, scoreFixture } from "@/lib/engine/scoring"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
}: {
  fixtureId: number
  homeName: string
  awayName: string
  categories: Cat[]
  initialScores?: Record<string, SetScore[]>
  isEdit?: boolean
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [sets, setSets] = useState<Record<string, SetScore[]>>(
    Object.fromEntries(categories.map((c) => [c.category, normalizeSets(initialScores?.[c.category])])),
  )

  function setGame(cat: string, idx: number, side: "home" | "away", value: number) {
    setSets((prev) => {
      const rows = prev[cat].map((r, i) => (i === idx ? { ...r, [side]: Math.max(0, Math.min(99, value)) } : r))
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
        toast.success(res?.success ?? "Submitted")
        onDone?.()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="flex-1 truncate">{homeName}</span>
        <span className="px-2 text-muted-foreground">vs</span>
        <span className="flex-1 truncate text-right">{awayName}</span>
      </div>

      <div className="space-y-3">
        {categories.map((c) => {
          const rows = sets[c.category] ?? EMPTY_SETS
          const t = tallySets(rows)
          const hw = t.homeSetsWon > t.awaySetsWon
          const aw = t.awaySetsWon > t.homeSetsWon
          return (
            <div key={c.category} className="rounded-md border border-border px-3 py-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.category}</span>
                  {c.isFeatureCourt && (
                    <Badge variant="secondary" className="text-[10px]">
                      Feature
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  Sets{" "}
                  <span className={cn(hw && "font-bold text-primary")}>{t.homeSetsWon}</span>
                  {"–"}
                  <span className={cn(aw && "font-bold text-primary")}>{t.awaySetsWon}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-8 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Set {i + 1}
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={r.home === 0 ? "" : r.home}
                      placeholder="0"
                      onChange={(e) => setGame(c.category, i, "home", Number(e.target.value))}
                      className="h-9 w-12 px-1 text-center"
                      aria-label={`${homeName} games in ${c.category} set ${i + 1}`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={r.away === 0 ? "" : r.away}
                      placeholder="0"
                      onChange={(e) => setGame(c.category, i, "away", Number(e.target.value))}
                      className="h-9 w-12 px-1 text-center"
                      aria-label={`${awayName} games in ${c.category} set ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-1 rounded-md bg-secondary px-4 py-3 text-sm">
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
      <p className="text-center text-xs text-muted-foreground">
        Enter the actual game score for each set (e.g. 6–4). Standings and TPR update immediately; either
        captain can edit the result later if there&apos;s a mistake.
      </p>
    </div>
  )
}
