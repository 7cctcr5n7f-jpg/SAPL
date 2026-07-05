// Shared, framework-agnostic helpers for the League Operations Console.
// Safe to import from both server and client components (no server-only deps).
import { CATEGORY_RULES, FIXTURE_TIMESLOTS } from "@/lib/constants"

export type CourtAssignment = { court: string | null; time: string | null }
export type CourtAssignments = Record<string, CourtAssignment>
export type CourtLinks = Record<string, string>

/** The four category rubbers every fixture is played over, in display order. */
export const CATEGORIES = [...CATEGORY_RULES]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((c) => ({ category: c.name, session: c.session, isFeatureCourt: c.isFeatureCourt }))

export const CATEGORY_COUNT = CATEGORIES.length

/** Default league-night start time for a category's session. */
export function defaultTimeForSession(session: number): string {
  return session >= 2 ? FIXTURE_TIMESLOTS[1] : FIXTURE_TIMESLOTS[0]
}

/**
 * Suggests court numbers + start times from the host club's court count.
 * Session 1 categories start at 17:00, session 2 at 18:30; courts wrap onto the
 * available count so a 2-court venue staggers sessions. This is a non-destructive
 * suggestion used only to prefill the editor when nothing has been saved yet.
 */
export function defaultCourtAssignments(venueCourts: number | null | undefined): CourtAssignments {
  const courts = venueCourts && venueCourts > 0 ? venueCourts : CATEGORY_COUNT
  const out: CourtAssignments = {}
  // Track how many categories we've placed per session so each new one takes the
  // next court within that session.
  const perSessionIndex: Record<number, number> = {}
  for (const c of CATEGORIES) {
    const idx = perSessionIndex[c.session] ?? 0
    perSessionIndex[c.session] = idx + 1
    out[c.category] = {
      court: String((idx % courts) + 1),
      time: defaultTimeForSession(c.session),
    }
  }
  return out
}

/** Basic Playtomic/booking URL check (protocol optional). */
export function isValidBookingUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const v = url.trim()
  if (!v) return false
  return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)
}

/** A category is "ready" when it has a court, a time, and a valid booking link. */
export function categoryReady(assignment: CourtAssignment | undefined, link: string | undefined): boolean {
  return Boolean(assignment?.court && assignment?.time && isValidBookingUrl(link))
}

export type FixtureLike = {
  homeTeamId: number | null
  awayTeamId: number | null
  venueClubId: number | null
  matchDate: Date | string | null
  status: string
  published: boolean
  courtAssignments: CourtAssignments | null
  courtLinks: CourtLinks | null
}

/** How many of the four categories are fully booked/ready for a fixture. */
export function readyCategoryCount(fx: FixtureLike): number {
  const ca = fx.courtAssignments ?? {}
  const cl = fx.courtLinks ?? {}
  return CATEGORIES.reduce((n, c) => n + (categoryReady(ca[c.category], cl[c.category]) ? 1 : 0), 0)
}

export type OpsStatus =
  | "planned"
  | "missing_links"
  | "ready_to_publish"
  | "published"
  | "awaiting_result"
  | "completed"

export type OpsStatusInfo = {
  status: OpsStatus
  label: string
  /** Tailwind classes for the status pill (bg + text). */
  tone: string
  readyCount: number
  total: number
}

/**
 * Derives the operational status of a fixture for the console grid.
 * Order of precedence: completed → awaiting result (published, playable) →
 * published → ready-to-publish → missing links → planned.
 */
export function deriveOpsStatus(fx: FixtureLike): OpsStatusInfo {
  const readyCount = readyCategoryCount(fx)
  const total = CATEGORY_COUNT
  const hasTeams = fx.homeTeamId != null && fx.awayTeamId != null
  const allReady = readyCount === total && hasTeams && fx.venueClubId != null && fx.matchDate != null

  if (fx.status === "completed") {
    return { status: "completed", label: "Completed", tone: "bg-emerald-500/15 text-emerald-400", readyCount, total }
  }
  if (fx.published) {
    return {
      status: "awaiting_result",
      label: "Awaiting Result",
      tone: "bg-amber-500/15 text-amber-400",
      readyCount,
      total,
    }
  }
  if (allReady) {
    return {
      status: "ready_to_publish",
      label: "Ready to Publish",
      tone: "bg-sky-500/15 text-sky-400",
      readyCount,
      total,
    }
  }
  if (readyCount > 0 || hasTeams) {
    return {
      status: "missing_links",
      label: "Missing Booking Links",
      tone: "bg-orange-500/15 text-orange-400",
      readyCount,
      total,
    }
  }
  return { status: "planned", label: "Planned", tone: "bg-muted text-muted-foreground", readyCount, total }
}

/** Can a fixture be published? All categories ready + teams + venue + date. */
export function canPublish(fx: FixtureLike): { ok: boolean; reason: string | null } {
  if (fx.homeTeamId == null || fx.awayTeamId == null) return { ok: false, reason: "Both teams must be assigned." }
  if (fx.venueClubId == null) return { ok: false, reason: "Assign a host venue first." }
  if (fx.matchDate == null) return { ok: false, reason: "Set a match date first." }
  if (readyCategoryCount(fx) < CATEGORY_COUNT) {
    return { ok: false, reason: "Every category needs a court, time and booking link." }
  }
  return { ok: true, reason: null }
}
