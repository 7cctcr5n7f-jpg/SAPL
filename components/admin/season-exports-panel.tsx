"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download } from "lucide-react"

export function SeasonExportsPanel({
  seasons,
}: {
  seasons: { id: number; name: string; isCurrent: boolean; weeks: number }[]
}) {
  async function downloadExport(url: string, fallbackName: string) {
    const response = await fetch(url, { method: "GET", credentials: "same-origin" })
    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`)
    }
    const blob = await response.blob()
    const contentDisposition = response.headers.get("content-disposition") ?? ""
    const match = /filename="([^"]+)"/i.exec(contentDisposition)
    const filename = match?.[1] ?? fallbackName
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Exports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Export team/player PR snapshots and week-by-week fixture lineups for external prediction tools.
        </p>

        {seasons.map((season) => (
          <div key={season.id} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="font-semibold">{season.name}</p>
              {season.isCurrent ? <Badge>Current</Badge> : null}
            </div>

            <div className="mb-4">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  downloadExport(
                    `/api/admin/seasons/export?type=teams&seasonId=${season.id}`,
                    `season-${season.id}-teams-players.xlsx`,
                  ).catch(() => {
                    window.location.href = `/api/admin/seasons/export?type=teams&seasonId=${season.id}`
                  })
                }
              >
                <Download className="h-4 w-4" />
                Export teams & players
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fixture exports by week</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: season.weeks }, (_, index) => index + 1).map((week) => (
                  <Button
                    key={week}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadExport(
                        `/api/admin/seasons/export?type=fixtures&seasonId=${season.id}&week=${week}`,
                        `season-${season.id}-week-${week}-fixtures.csv`,
                      ).catch(() => {
                        window.location.href = `/api/admin/seasons/export?type=fixtures&seasonId=${season.id}&week=${week}`
                      })
                    }
                  >
                    Week {week}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Results exports by week</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: season.weeks }, (_, index) => index + 1).map((week) => (
                  <Button
                    key={`results-${week}`}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadExport(
                        `/api/admin/seasons/export?type=results&seasonId=${season.id}&week=${week}`,
                        `season-${season.id}-week-${week}-results.xlsx`,
                      ).catch(() => {
                        window.location.href = `/api/admin/seasons/export?type=results&seasonId=${season.id}&week=${week}`
                      })
                    }
                  >
                    Week {week} results
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
