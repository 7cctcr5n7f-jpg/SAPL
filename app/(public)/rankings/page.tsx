import Link from "next/link"
import { getTeamRankings, getCpiRankings } from "@/lib/queries"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DivisionTag } from "@/components/brand/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const metadata = { title: "Rankings | SAPL" }

export default async function RankingsPage() {
  const [tpr, cpi] = await Promise.all([getTeamRankings(100), getCpiRankings()])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-12">
      <div className="border-l-4 border-primary pl-4">
        <h1 className="heading text-3xl md:text-5xl">Rankings</h1>
        <p className="mt-1 text-sm text-muted-foreground md:mt-2 md:text-base">
          Team Power Rating and Club Performance Index leaderboards.
        </p>
      </div>

      <Tabs defaultValue="tpr" className="mt-6 md:mt-8">
        <TabsList>
          <TabsTrigger value="tpr">Team Power Rating</TabsTrigger>
          <TabsTrigger value="cpi">Club Performance Index</TabsTrigger>
        </TabsList>

        <TabsContent value="tpr" className="mt-4 md:mt-6">
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-card">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="hidden md:table-cell">Organisation</TableHead>
                  <TableHead className="hidden sm:table-cell">Division</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Peak</TableHead>
                  <TableHead className="text-right">TPR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tpr.map((t, i) => (
                  <TableRow key={t.teamId}>
                    <TableCell className="heading text-primary tabular-nums">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/teams/${t.teamId}`} className="font-semibold hover:text-primary">
                        {t.teamName}
                      </Link>
                      <span className="block text-xs text-muted-foreground md:hidden">{t.orgName}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{t.orgName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {t.divisionName ? <DivisionTag name={t.divisionName} /> : "—"}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                      {Math.round(t.highestTpr)}
                    </TableCell>
                    <TableCell className="text-right heading text-lg tabular-nums">{Math.round(t.tpr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cpi" className="mt-4 md:mt-6">
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-card">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden sm:table-cell">City</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Teams</TableHead>
                  <TableHead className="text-right">CPI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cpi.map((c, i) => (
                  <TableRow key={c.orgId}>
                    <TableCell className="heading text-primary tabular-nums">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/clubs/${c.orgSlug}`} className="font-semibold hover:text-primary">
                        {c.orgName}
                      </Link>
                      <span className="block text-xs text-muted-foreground sm:hidden">
                        {c.city ?? "—"} · {c.teamCount} teams
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{c.type}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{c.city ?? "—"}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{c.teamCount}</TableCell>
                    <TableCell className="text-right heading text-lg tabular-nums">{Math.round(c.cpi)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
