import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Crest } from "@/components/league-centre/crest"
import { Badge } from "@/components/ui/badge"
import type { LCFixture } from "@/lib/queries-league-centre"
import { ArrowRight, CalendarDays, MapPin, Trophy } from "lucide-react"

function dateLabel(iso: string | null, timeslot: string | null) {
  if (!iso) return timeslot ?? "Date TBD"
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short" }).format(d)
  const time = timeslot ?? new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return `${date} · ${time}`
}

function Row({ f }: { f: LCFixture }) {
  const isResult = f.status === "completed"
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const awayWon = f.winnerTeamId != null && f.winnerTeamId === f.awayTeamId
  return (
    <Link
      href={`/league-centre/match/${f.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-center gap-2">
          <Crest name={f.homeName} logoUrl={f.homeLogo} size="sm" />
          <span className={`truncate text-sm ${homeWon ? "font-semibold" : ""}`}>{f.homeName ?? "TBD"}</span>
        </div>
        {isResult ? (
          <span className="shrink-0 text-sm font-bold tabular-nums">
            {f.homePoints ?? 0}–{f.awayPoints ?? 0}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">vs</span>
        )}
        <div className="flex items-center gap-2">
          <Crest name={f.awayName} logoUrl={f.awayLogo} size="sm" />
          <span className={`truncate text-sm ${awayWon ? "font-semibold" : ""}`}>{f.awayName ?? "TBD"}</span>
        </div>
      </div>
      <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {dateLabel(f.matchDate, f.timeslot)}
        </span>
        {f.venue && (
          <span className="mt-0.5 flex items-center justify-end gap-1">
            <MapPin className="h-3 w-3" />
            {f.venue}
          </span>
        )}
      </div>
    </Link>
  )
}

export function MySeason({ matches }: { matches: LCFixture[] }) {
  const upcoming = matches
    .filter((m) => m.status !== "completed")
    .sort((a, b) => (a.matchDate ?? "").localeCompare(b.matchDate ?? ""))
  const results = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => (b.matchDate ?? "").localeCompare(a.matchDate ?? ""))

  const next = upcoming[0]

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-2 pt-6 text-sm text-muted-foreground">
          <p>No scheduled matches yet. Your fixtures appear here once the season draw is published.</p>
          <Link href="/league-centre" className="inline-flex items-center gap-1 text-primary hover:underline">
            Explore the League Centre <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {next && (
        <Card className="overflow-hidden border-primary/30">
          <div className="border-b border-border bg-gradient-to-br from-primary/10 to-transparent px-5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Next Match
            </span>
          </div>
          <CardContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Crest name={next.homeName} logoUrl={next.homeLogo} size="md" />
              <span className="text-sm font-semibold">{next.homeName ?? "TBD"}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-xl font-bold text-muted-foreground">vs</span>
              <span className="text-[11px] text-muted-foreground">{dateLabel(next.matchDate, next.timeslot)}</span>
              {next.divisionName && (
                <Badge variant="outline" className="text-[10px]">
                  {next.divisionName}
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Crest name={next.awayName} logoUrl={next.awayLogo} size="md" />
              <span className="text-sm font-semibold">{next.awayName ?? "TBD"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming</p>
          <div className="space-y-2">
            {upcoming.slice(1, 4).map((f) => (
              <Row key={f.id} f={f} />
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent Results</p>
          <div className="space-y-2">
            {results.slice(0, 3).map((f) => (
              <Row key={f.id} f={f} />
            ))}
          </div>
        </div>
      )}

      <Link
        href="/league-centre"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Open the League Centre <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
