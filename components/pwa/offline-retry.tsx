"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function OfflineRetry() {
  return (
    <Button onClick={() => window.location.reload()} className="gap-2">
      <RefreshCw className="h-4 w-4" />
      Try again
    </Button>
  )
}
