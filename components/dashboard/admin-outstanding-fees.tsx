import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stat } from "@/components/brand/bits"
import { fmtZAR } from "@/lib/format"
import { Mail, Phone, MessageCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OutstandingFee } from "@/lib/queries-dashboard"

// Normalise a SA mobile number to international format for wa.me links.
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0")) return `27${digits.slice(1)}`
  if (digits.startsWith("27")) return digits
  return digits
}

export function AdminOutstandingFees({ fees }: { fees: OutstandingFee[] }) {
  const total = fees.reduce((s, f) => s + f.amount + f.vatAmount, 0)
  const uniquePlayers = new Set(fees.filter((f) => f.kind === "player").map((f) => f.playerId)).size
  const fundedTeams = fees.filter((f) => f.kind === "team").length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <Stat label="Total outstanding" value={fmtZAR(total)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Players owing" value={uniquePlayers} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Funding teams owing" value={fundedTeams} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding league fees</CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding fees. Everyone is paid up.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Amount (incl. VAT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((f) => (
                  <TableRow key={`${f.teamId}-${f.playerId}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{f.playerName}</span>
                        {f.kind === "team" && (
                          <Badge variant="secondary" className="w-fit text-[10px]">
                            Team owner · funds squad
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.teamName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        {f.email ? (
                          <a
                            href={`mailto:${f.email}?subject=${encodeURIComponent("SAPL league fee outstanding")}`}
                            className="inline-flex items-center gap-1.5 text-foreground hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            {f.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No email</span>
                        )}
                        {f.phone ? (
                          <span className="inline-flex items-center gap-2">
                            <a
                              href={`tel:${f.phone}`}
                              className="inline-flex items-center gap-1.5 text-foreground hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {f.phone}
                            </a>
                            <a
                              href={`https://wa.me/${waNumber(f.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-green-600 hover:underline"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No mobile</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold">{fmtZAR(f.amount + f.vatAmount)}</span>
                        <Badge variant="destructive">Due</Badge>
                      </div>
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
