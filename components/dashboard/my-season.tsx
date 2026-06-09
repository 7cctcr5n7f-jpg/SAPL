import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Crest } from "@/components/league-centre/crest"
import { Badge } from "@/components/ui/badge"
import { MatchRow, MatchList, MatchGroupHeader } from "@/components/league-centre/match-row"
import type { LCFixture } from "@/lib/queries-league-centre"
import { ArrowRight, ExternalLink, MapPin, Trophy } from "lucide-react"

function dateLabel(iso: string | null, timeslot: string | null) {
  if (!iso) return timeslot ?? "Date TBD"
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short" }).format(d)
  const time = timeslot ?? new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return `${date} · ${time}`
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
          <div className="border-b border-border bg-gradient-to-br from-primary/10 to-transparent px-4 py-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Next Match
            </span>
          </div>
          <CardContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Crest name={next.homeName} logoUrl={next.homeLogo} size="md" />
              <span className="text-sm font-semibold">{next.homeName ?? "TBD"}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="heading text-lg text-muted-foreground">VS</span>
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
          {(next.venue || next.joinUrl) && (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {next.venue ? (
                  <>
                    <MapPin className="h-3.5 w-3.5" />
                    {next.venue}
                  </>
                ) : (
                  "Venue to be confirmed"
                )}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/league-centre/match/${next.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  View details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {next.joinUrl && (
                  <a
                    href={next.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Join on Playtomic
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {upcoming.length > 1 && (
        <MatchList>
          <MatchGroupHeader label="Upcoming" sub={`${upcoming.length - 1} more`} />
          <div className="divide-y divide-border">
            {upcoming.slice(1, 4).map((f) => (
              <MatchRow key={f.id} fixture={f} showMeta />
            ))}
          </div>
        </MatchList>
      )}

      {results.length > 0 && (
        <MatchList>
          <MatchGroupHeader label="Recent Results" sub={`${results.length} played`} />
          <div className="divide-y divide-border">
            {results.slice(0, 3).map((f) => (
              <MatchRow key={f.id} fixture={f} showMeta />
            ))}
          </div>
        </MatchList>
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
