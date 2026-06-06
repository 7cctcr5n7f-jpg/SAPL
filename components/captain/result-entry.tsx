"use client"

import { useState, useTransition } from "react"
import { submitResult, type SubmittedCategory } from "@/lib/actions/captain"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Cat = { category: string; session: number; isFeatureCourt: boolean }

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
  initialScores?: Record<string, { home: number; away: number }>
  isEdit?: boolean
  onDone?: () => void
}) {
  const [pending, start] = useTransition()
  const [scores, setScores] = useState<Record<string, { home: number; away: number }>>(
    Object.fromEntries(
      categories.map((c) => [c.category, initialScores?.[c.category] ?? { home: 0, away: 0 }]),
    ),
  )

  function setScore(cat: string, side: "home" | "away", value: number) {
    setScores((s) => ({ ...s, [cat]: { ...s[cat], [side]: Math.max(0, value) } }))
  }

  const homeSets = Object.values(scores).reduce((s, v) => s + v.home, 0)
  const awaySets = Object.values(scores).reduce((s, v) => s + v.away, 0)
  const homePoints = homeSets + (homeSets > awaySets ? 1 : 0)
  const awayPoints = awaySets + (awaySets > homeSets ? 1 : 0)

  function submit() {
    const payload: SubmittedCategory[] = categories.map((c) => ({
      category: c.category,
      session: c.session,
      isFeatureCourt: c.isFeatureCourt,
      homeSetsWon: scores[c.category].home,
      awaySetsWon: scores[c.category].away,
    }))
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
        <span>{homeName}</span>
        <span className="text-muted-foreground">vs</span>
        <span>{awayName}</span>
      </div>

      <div className="space-y-2">
        {categories.map((c) => {
          const sc = scores[c.category]
          const hw = sc.home > sc.away
          const aw = sc.away > sc.home
          return (
            <div
              key={c.category}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{c.category}</span>
                {c.isFeatureCourt && (
                  <Badge variant="secondary" className="text-[10px]">
                    Feature
                  </Badge>
                )}
              </div>
              <Input
                type="number"
                min={0}
                value={sc.home}
                onChange={(e) => setScore(c.category, "home", Number(e.target.value))}
                className={cn("h-8 w-14 text-center", hw && "border-primary text-primary")}
                aria-label={`${homeName} sets in ${c.category}`}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                value={sc.away}
                onChange={(e) => setScore(c.category, "away", Number(e.target.value))}
                className={cn("h-8 w-14 text-center", aw && "border-primary text-primary")}
                aria-label={`${awayName} sets in ${c.category}`}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-md bg-secondary px-4 py-3 text-sm">
        <span className="font-semibold">Fixture points</span>
        <span className="font-mono text-base font-bold">
          {homePoints} <span className="text-muted-foreground">–</span> {awayPoints}
        </span>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? "Saving..." : isEdit ? "Save changes" : "Submit Result"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {isEdit
          ? "Editing this result will immediately recalculate standings and TPR."
          : "Standings and TPR update immediately. Either team's captain can edit the result later if there's a mistake."}
      </p>
    </div>
  )
}
