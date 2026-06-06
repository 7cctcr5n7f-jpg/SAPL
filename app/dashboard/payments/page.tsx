import { getCurrentUser } from "@/lib/session"
import { getPlayerPayments, getPlayerTeamFees, getOutstandingFees } from "@/lib/queries-dashboard"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stat } from "@/components/brand/bits"
import { fmtZAR, fmtDate } from "@/lib/format"
import { NoProfile } from "@/components/dashboard/no-profile"
import { TeamFees } from "@/components/dashboard/team-fees"
import { AdminOutstandingFees } from "@/components/dashboard/admin-outstanding-fees"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  pending: "secondary",
  failed: "destructive",
  refunded: "outline",
}

export default async function PaymentsPage() {
  const me = await getCurrentUser()
  if (!me) return null

  const isAdmin = me.role === "league_admin" || me.role === "super_admin"

  // Non-admin player without a profile: keep the existing empty state.
  if (!me.playerId && !isAdmin) {
    return (
      <NoProfile
        title="Fees & Invoices"
        subtitle="Registration and team fees. All amounts include 15% VAT."
        message="Create your player profile to view and pay your registration and team fees."
      />
    )
  }

  const myFees = me.playerId ? <MyFees userId={me.id} playerId={me.playerId} /> : <NoProfileInline />

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Fees & Invoices" subtitle="Registration and team fees. All amounts include 15% VAT." />
        {myFees}
      </div>
    )
  }

  const outstanding = await getOutstandingFees()

  return (
    <div>
      <PageHeader title="Fees & Invoices" subtitle="Registration and team fees. All amounts include 15% VAT." />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My Fees</TabsTrigger>
          <TabsTrigger value="outstanding">
            Outstanding Fees
            {outstanding.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 px-1.5">
                {outstanding.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="mt-6">
          {myFees}
        </TabsContent>
        <TabsContent value="outstanding" className="mt-6">
          <AdminOutstandingFees fees={outstanding} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NoProfileInline() {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a player profile, so there are no personal fees to show. Use the Outstanding Fees tab to
          chase up player payments.
        </p>
      </CardContent>
    </Card>
  )
}

async function MyFees({ userId, playerId }: { userId: string; playerId: number }) {
  const payments = await getPlayerPayments(userId, playerId)
  const teamFees = await getPlayerTeamFees(playerId)

  const feesDue = teamFees
    .filter((f) => f.status === "due")
    .reduce((s, f) => s + f.amount + f.vatAmount, 0)
  const outstanding =
    payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount + p.vatAmount, 0) + feesDue
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount + p.vatAmount, 0)

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <Stat label="Outstanding" value={fmtZAR(outstanding)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Paid to date" value={fmtZAR(paid)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Invoices" value={payments.length} />
          </CardContent>
        </Card>
      </div>

      <TeamFees fees={teamFees} />

      <h2 className="mb-3 text-lg font-semibold">Invoices</h2>
      <Card>
        <CardContent className="pt-6">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount (incl. VAT)</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.invoiceNumber ?? `INV-${p.id}`}</TableCell>
                    <TableCell>{p.description ?? p.type}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(p.createdAt)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtZAR(p.amount + p.vatAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"} className="capitalize">
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
