import { notFound } from "next/navigation"
import Link from "next/link"
import { getMatchDetail } from "@/lib/queries-league-centre"
import { Crest } from "@/components/league-centre/crest"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin, CalendarDays, Radio } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Full Time",
}

function dateLabel(iso: string | null, timeslot: string | null) {
  if (!iso) return timeslot ?? "Date TBD"
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long" }).format(d)
  const time = timeslot ?? new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return `${date} · ${time}`
}

export default async function DashboardMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixtureId = Number(id)
  if (!Number.isFinite(fixtureId)) notFound()
  const detail = await getMatchDetail(fixtureId)
  if (!detail) notFound()

  const { fixture: f, rubbers } = detail
  const isCompleted = f.status === "completed"
  const isLive = f.status === "live"
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const awayWon = f.winnerTeamId != null && f.winnerTeamId === f.awayTeamId

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/league-centre"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to League Centre
      </Link>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Header band */}
        <div className="relative border-b border-border bg-gradient-to-br from-secondary to-card px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {f.divisionName && <Badge variant="outline">{f.divisionName}</Badge>}
              {f.regionName && <Badge variant="outline">{f.regionName}</Badge>}
              <span>Week {f.week}</span>
            </div>
            <Badge
              className={
                isLive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground"
              }
            >
              {isLive && <Radio className="mr-1 h-3 w-3 animate-pulse" />}
              {STATUS_LABEL[f.status] ?? f.status}
            </Badge>
          </div>
        </div>

        {/* Scoreline */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Crest name={f.homeName} logoUrl={f.homeLogo} size="lg" />
            <span className={`text-sm font-semibold ${homeWon ? "text-foreground" : "text-muted-foreground"}`}>
              {f.homeName ?? "TBD"}
            </span>
          </div>
          <div className="flex flex-col items-center">
            {isCompleted || isLive ? (
              <div className="flex items-center gap-3 text-4xl font-extrabold tabular-nums">
                <span className={homeWon ? "text-foreground" : "text-muted-foreground"}>{f.homePoints ?? 0}</span>
                <span className="text-border">-</span>
                <span className={awayWon ? "text-foreground" : "text-muted-foreground"}>{f.awayPoints ?? 0}</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">vs</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <Crest name={f.awayName} logoUrl={f.awayLogo} size="lg" />
            <span className={`text-sm font-semibold ${awayWon ? "text-foreground" : "text-muted-foreground"}`}>
              {f.awayName ?? "TBD"}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {dateLabel(f.matchDate, f.timeslot)}
          </span>
          {f.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {f.venue}
            </span>
          )}
        </div>
      </div>

      {/* Rubbers */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Rubbers</h2>
        {rubbers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            {isCompleted
              ? "No rubber-by-rubber breakdown was recorded for this match."
              : "Court-by-court results will appear here once the match is played."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {rubbers.map((r, i) => {
              const rHome = r.winnerTeamId != null && r.winnerTeamId === f.homeTeamId
              const rAway = r.winnerTeamId != null && r.winnerTeamId === f.awayTeamId
              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between gap-4 px-4 py-3 ${i % 2 ? "bg-card" : "bg-secondary/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{r.category}</span>
                    {r.isFeatureCourt && (
                      <Badge variant="outline" className="text-[10px]">
                        Feature Court
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {r.scoreDetail && <span className="text-muted-foreground">{r.scoreDetail}</span>}
                    <span className="font-semibold tabular-nums">
                      <span className={rHome ? "text-foreground" : "text-muted-foreground"}>{r.homeSetsWon}</span>
                      <span className="mx-1 text-border">-</span>
                      <span className={rAway ? "text-foreground" : "text-muted-foreground"}>{r.awaySetsWon}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
