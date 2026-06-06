import Link from "next/link"
import { notFound } from "next/navigation"
import { Stat, DivisionTag } from "@/components/brand/bits"
import { TprLine } from "@/components/charts/tpr-line"
import { getTeamDetail } from "@/lib/queries"
import { ArrowLeft, Crown, User } from "lucide-react"

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teamId = Number(id)
  if (Number.isNaN(teamId)) notFound()
  const data = await getTeamDetail(teamId)
  if (!data) notFound()
  const { team, roster, history } = data

  const chartData = history.map((h, i) => ({
    label: i === 0 ? "Start" : `R${i}`,
    tpr: Math.round(h.tpr),
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <Link
        href={team.orgSlug ? `/clubs/${team.orgSlug}` : "/clubs"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> {team.orgName ?? "Clubs"}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div>
          {team.divisionName ? <DivisionTag name={team.divisionName} /> : null}
          <h1 className="heading mt-2 text-4xl md:text-6xl">{team.name}</h1>
          <p className="mt-2 text-muted-foreground">{team.orgName}</p>
        </div>
        <div className="text-right">
          <div className="heading text-5xl text-primary tabular-nums">{Math.round(team.tpr)}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Team Power Rating</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 border-b border-border py-8 md:grid-cols-4">
        <Stat label="Current TPR" value={Math.round(team.tpr)} />
        <Stat label="Peak TPR" value={Math.round(team.highestTpr ?? team.tpr)} />
        <Stat label="Roster" value={roster.length} />
        <Stat label="Status" value={team.status === "active" ? "Active" : team.status} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="heading text-2xl">TPR Trajectory</h2>
          <p className="mt-1 text-sm text-muted-foreground">ELO-based rating across the season.</p>
          <div className="mt-4">
            <TprLine data={chartData} />
          </div>
        </div>

        <div>
          <h2 className="heading text-2xl">Roster</h2>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {roster.map((p) => (
              <li key={p.memberId} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                    {p.role === "captain" ? (
                      <Crown className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <div>
                    <div className="font-medium">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      {p.role === "captain" ? "Captain" : "Player"} &middot; {p.gender}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">LI {p.currentLi?.toFixed(1) ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    TPR {Math.round(p.currentTpr ?? 0)}
                  </div>
                </div>
              </li>
            ))}
            {roster.length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">No active roster members.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  )
}
