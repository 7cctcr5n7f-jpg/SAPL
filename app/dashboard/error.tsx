"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.log("[v0] dashboard route error:", error.message, error.digest)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">We couldn&apos;t load this page</h2>
        <p className="text-sm text-muted-foreground">
          Your last change was saved. This view just needs a refresh to catch up — try again below.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  )
}
