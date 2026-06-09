"use client"

import { useTransition } from "react"
import Link from "next/link"
import { markAllRead } from "@/lib/actions/notifications"
import { parseNotificationBody } from "@/lib/notify-constants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fmtDateTime } from "@/lib/format"
import { Bell, ArrowRight } from "lucide-react"

type Note = {
  id: number
  title: string
  body: string
  type: string
  channel: string
  scope?: string | null
  scopeId?: number | null
  readAt: Date | string | null
  createdAt: Date | string
}

// Notification types that link to a fixture detail page (via scopeId).
const FIXTURE_LINK_TYPES = new Set(["result_recorded", "fixture_ready", "fixture_updated", "fixture_created"])

function actionLabel(type: string) {
  if (type === "fixture_ready") return "View & join"
  return "View match"
}

/** Split a stored body into its display text and any packed action href. */
const parseBody = parseNotificationBody

/** Resolve the best action link + label for a notification. */
function resolveAction(n: Note): { href: string; label: string } | null {
  const { href } = parseBody(n.body)
  if (href) return { href, label: actionLabel(n.type) }
  if (FIXTURE_LINK_TYPES.has(n.type) && n.scopeId != null) {
    return { href: `/league-centre/match/${n.scopeId}`, label: actionLabel(n.type) }
  }
  return null
}

export function NotificationsList({ notes }: { notes: Note[] }) {
  const [pending, start] = useTransition()
  const unread = notes.filter((n) => !n.readAt).length

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        {unread > 0 && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => {
            void markAllRead()
          })}>
            Mark all read
          </Button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Bell className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const action = resolveAction(n)
            return (
            <div
              key={n.id}
              className={cn(
                "flex gap-3 rounded-md border px-4 py-3",
                n.readAt ? "border-border bg-card" : "border-primary/40 bg-secondary",
              )}
            >
              <div
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.readAt ? "bg-muted-foreground/40" : "bg-primary",
                )}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{parseBody(n.body).text}</p>
                {n.channel === "whatsapp" && (
                  <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider text-primary">
                    WhatsApp
                  </span>
                )}
                {action && (
                  <Link
                    href={action.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    {action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
