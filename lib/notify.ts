import { db } from "@/lib/db"
import { notifications, teams, teamMembers, players, user as userTable } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { notificationProvider, type NotificationChannel } from "@/lib/providers"

export type NotifyInput = {
  userId?: string | null
  scope?: "broadcast" | "team" | "club" | "division" | "direct" | "user"
  scopeId?: number | null
  type: string
  title: string
  body: string
  channel?: NotificationChannel
  to?: string
  /** Optional action link rendered as a button in the notifications list. */
  href?: string | null
}

// Marker used to embed an action link inside the stored body. The list UI
// splits on this to render a button without needing a schema migration.
export const NOTE_LINK_SEP = "\u0001link\u0001"

function packBody(body: string, href?: string | null) {
  return href ? `${body}${NOTE_LINK_SEP}${href}` : body
}

/**
 * Persists an in-app notification and dispatches it through the configured
 * provider (WhatsApp/email). The provider currently queues + logs until real
 * credentials are wired in — swap the provider implementation to go live.
 */
export async function notify(input: NotifyInput) {
  const channel = input.channel ?? "in_app"
  const dispatch = await notificationProvider.send({
    channel,
    to: input.to,
    title: input.title,
    body: input.body,
  })

  await db.insert(notifications).values({
    userId: input.userId ?? null,
    type: input.type,
    title: input.title,
    body: packBody(input.body, input.href),
    channel,
    status: dispatch.status,
    scope: input.scope === "user" ? "direct" : (input.scope ?? null),
    scopeId: input.scopeId ?? null,
    sentAt: dispatch.status === "sent" ? new Date() : null,
  })

  return dispatch
}

/**
 * Resolve the set of user ids associated with a team: the captain, the manager,
 * the registered owner (matched by email), and all active roster players.
 */
async function getTeamUserIds(teamId: number): Promise<string[]> {
  const ids = new Set<string>()

  const [team] = await db
    .select({
      captainUserId: teams.captainUserId,
      managerUserId: teams.managerUserId,
      ownerEmail: teams.ownerEmail,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (team?.captainUserId) ids.add(team.captainUserId)
  if (team?.managerUserId) ids.add(team.managerUserId)

  const ownerEmail = team?.ownerEmail?.trim().toLowerCase()
  if (ownerEmail) {
    const [owner] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(sql`lower(${userTable.email}) = ${ownerEmail}`)
      .limit(1)
    if (owner?.id) ids.add(owner.id)
  }

  const roster = await db
    .select({ userId: players.userId })
    .from(teamMembers)
    .innerJoin(players, eq(teamMembers.playerId, players.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))
  for (const r of roster) if (r.userId) ids.add(r.userId)

  return [...ids]
}

export type NotifyTeamInput = {
  type: string
  title: string
  body: string
  channel?: NotificationChannel
  /** Optional fixture this notification relates to (stored as scopeId for action links). */
  fixtureId?: number | null
  /** Optional action link rendered as a button in the notifications list. */
  href?: string | null
}

/**
 * Fan out an in-app notification to everyone connected to a team (captain,
 * manager, owner + active roster). Each recipient gets their own notification
 * row so unread/read state is tracked per user. When `fixtureId` is supplied it
 * is stored on `scopeId` so the notifications UI can render a "View"/"Join".
 */
export async function notifyTeam(teamId: number, input: NotifyTeamInput) {
  const userIds = await getTeamUserIds(teamId)
  await Promise.all(
    userIds.map((userId) =>
      notify({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channel: input.channel,
        href: input.href,
        scope: input.fixtureId != null ? "direct" : undefined,
        scopeId: input.fixtureId ?? null,
      }),
    ),
  )
  return userIds.length
}
