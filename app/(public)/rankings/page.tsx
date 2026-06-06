import Link from "next/link"
import { getTeamRankings, getCpiRankings } from "@/lib/queries"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DivisionTag } from "@/components/brand/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const metadata = { title: "Rankings | SAPL" }

export default async function RankingsPage() {
  const [tpr, cpi] = await Promise.all([getTeamRankings(100), getCpiRankings()])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="border-l-4 border-primary pl-4">
        <h1 className="heading text-4xl md:text-5xl">Rankings</h1>
        <p className="mt-2 text-muted-foreground">Team Power Rating and Club Performance Index leaderboards.</p>
      </div>

      <Tabs defaultValue="tpr" className="mt-8">
        <TabsList>
          <TabsTrigger value="tpr">Team Power Rating</TabsTrigger>
          <TabsTrigger value="cpi">Club Performance Index</TabsTrigger>
        </TabsList>

        <TabsContent value="tpr" className="mt-6">
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-card">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-right">Peak</TableHead>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.orgName}</TableCell>
                    <TableCell>{t.divisionName ? <DivisionTag name={t.divisionName} /> : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Math.round(t.highestTpr)}
                    </TableCell>
                    <TableCell className="text-right heading text-lg tabular-nums">{Math.round(t.tpr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cpi" className="mt-6">
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-card">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Teams</TableHead>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.type}</TableCell>
                    <TableCell className="text-muted-foreground">{c.city ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.teamCount}</TableCell>
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
