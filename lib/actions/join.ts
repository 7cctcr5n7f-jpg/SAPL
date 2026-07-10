"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { sendEmail, adminNewTeamEmail, ADMIN_EMAIL, appBaseUrl } from "@/lib/email"
import {
  user,
  userMeta,
  teams,
  teamMembers,
  teamInvites,
  clubs,
  organisations,
  seasons,
} from "@/lib/db/schema"
import { eq, and, asc, desc, gt, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

// ---------------------------------------------------------------------------
// Public data loaders (no auth required)
// ---------------------------------------------------------------------------

/**
 * Hosting clubs available for an external (public) team to select as their home venue.
 * A club is only listed when:
 *   1. It hosts Thursday fixtures (hostsThursday = true)
 *   2. It has at least one public slot (publicSlots > 0)
 *   3. The number of non-Club-Team teams already homed here is less than publicSlots
 *      (i.e. there is at least one public slot still free)
 */
export async function getHostingClubs(): Promise<{ id: number; name: string; saplRegion: string | null; courts: number }[]> {
  // Count non-Club-Team teams per club to determine public-slot usage.
  const publicUsageRows = await db
    .select({
      homeClubId: clubs.id,
      publicUsed: sql<number>`count(case when ${teams.teamType} != 'Club Team' then 1 end)::int`,
      publicSlots: clubs.publicSlots,
    })
    .from(clubs)
    .leftJoin(teams, eq(teams.homeClubId, clubs.id))
    .where(and(eq(clubs.hostsThursday, true), gt(clubs.publicSlots, 0)))
    .groupBy(clubs.id, clubs.publicSlots)

  const availableIds = publicUsageRows
    .filter((r) => (r.publicUsed ?? 0) < (r.publicSlots ?? 0))
    .map((r) => r.homeClubId)

  if (availableIds.length === 0) return []

  return db
    .select({ id: clubs.id, name: clubs.name, saplRegion: clubs.saplRegion, courts: clubs.courts })
    .from(clubs)
    .where(sql`${clubs.id} = ANY(ARRAY[${sql.raw(availableIds.join(","))}]::int[])`)
    .orderBy(asc(clubs.name))
}

/** Current season fees. */
export async function getCurrentFees(): Promise<{ playerFee: number; teamFee: number }> {
  const [season] = await db
    .select({ playerFee: seasons.playerFee })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1)
  return {
    playerFee: season?.playerFee ?? 500,
    teamFee: 4000,
  }
}

/** Check whether an email already has a pending team invite. Returns the invite info or null. */
export async function checkEmailInvite(
  email: string,
): Promise<{ teamName: string; category: string; invitedName: string | null; token: string } | null> {
  const normalized = email.trim().toLowerCase()
  const [invite] = await db
    .select({
      id: teamInvites.id,
      teamId: teamInvites.teamId,
      category: teamInvites.category,
      invitedName: teamInvites.invitedName,
      token: teamInvites.token,
    })
    .from(teamInvites)
    .where(and(eq(teamInvites.email, normalized), eq(teamInvites.status, "pending")))
    .orderBy(desc(teamInvites.createdAt))
    .limit(1)

  if (!invite) return null

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, invite.teamId)).limit(1)
  return {
    teamName: team?.name ?? "Unknown Team",
    category: invite.category ?? "Open",
    invitedName: invite.invitedName,
    token: invite.token ?? "",
  }
}

/** Look up an invite by token directly — used when arriving via /invite/<token> link. */
export async function checkInviteByToken(
  token: string,
): Promise<{ teamName: string; category: string; invitedName: string | null; token: string; email: string } | null> {
  const [invite] = await db
    .select({
      teamId: teamInvites.teamId,
      category: teamInvites.category,
      invitedName: teamInvites.invitedName,
      token: teamInvites.token,
      email: teamInvites.email,
      status: teamInvites.status,
    })
    .from(teamInvites)
    .where(and(eq(teamInvites.token, token), eq(teamInvites.status, "pending")))
    .limit(1)

  if (!invite) return null

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, invite.teamId)).limit(1)
  return {
    teamName: team?.name ?? "Unknown Team",
    category: invite.category ?? "Open",
    invitedName: invite.invitedName,
    token: invite.token ?? "",
    email: invite.email ?? "",
  }
}

// ---------------------------------------------------------------------------
// Register as Player
// ---------------------------------------------------------------------------

export type RegisterPlayerInput = {
  fullName: string
  email: string
  password: string
  gender: "male" | "female"
  playtomicUrl: string
  playtomicRating?: number
  joinMarketplace: boolean
  inviteToken?: string
}

export type RegisterResult = { ok: true; redirectTo: string } | { ok: false; error: string }

export async function registerPlayer(input: RegisterPlayerInput): Promise<RegisterResult> {
  const { fullName, email, password, gender, playtomicUrl, playtomicRating, joinMarketplace, inviteToken } = input

  if (!fullName.trim()) return { ok: false, error: "Full name is required." }
  if (!email.trim()) return { ok: false, error: "Email is required." }
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." }

  const nameParts = fullName.trim().split(" ")
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(" ") || ""

  // Sign up via Better Auth — signUpEmail throws an APIError on duplicate email
  const hdrs = await headers()
  let res: Awaited<ReturnType<typeof auth.api.signUpEmail>>
  try {
    res = await auth.api.signUpEmail({
      headers: hdrs,
      body: {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/onboarding",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("already in use")) {
      return { ok: false, error: "An account with this email already exists. Please sign in instead." }
    }
    return { ok: false, error: "Could not create account. Please try again." }
  }

  if (!res?.user) return { ok: false, error: "Could not create account. The email may already be in use." }

  const userId = res.user.id

  // Ensure userMeta
  await db
    .insert(userMeta)
    .values({ userId, role: "player" })
    .onConflictDoNothing()

  // Update user profile
  await db
    .update(user)
    .set({
      firstName,
      lastName,
      gender,
      isPlayer: true,
      playtomicUrl: playtomicUrl.trim() || null,
      playtomicRating: playtomicRating ?? null,
      lookingForTeam: joinMarketplace,
      onMarketplace: joinMarketplace,
      availability: joinMarketplace ? "available" : "unavailable",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))

  revalidatePath("/dashboard")
  // Invited players skip the onboarding wizard and go straight to the invite
  // accept page — their basic profile is already set above (name, isPlayer,
  // playtomicUrl). Non-invited players complete onboarding first.
  if (inviteToken) {
    return { ok: true, redirectTo: `/invite/${encodeURIComponent(inviteToken)}` }
  }
  return { ok: true, redirectTo: "/onboarding" }
}

// ---------------------------------------------------------------------------
// Register a Team
// ---------------------------------------------------------------------------

export type RegisterTeamInput = {
  // Account
  fullName: string
  email: string
  password: string
  // Team details
  teamName: string
  paymentModel: "club" | "individual" // club = R4,000 lump sum | individual = R500 per player
  homeClubId: number
  // Captain plays themselves?
  captainPlays: boolean
  captainGender?: "male" | "female"
  playtomicUrl: string
}

export async function registerTeam(input: RegisterTeamInput): Promise<RegisterResult> {
  const { fullName, email, password, teamName, paymentModel, homeClubId, captainPlays, captainGender, playtomicUrl } = input

  if (!fullName.trim()) return { ok: false, error: "Full name is required." }
  if (!email.trim()) return { ok: false, error: "Email is required." }
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." }
  if (!teamName.trim()) return { ok: false, error: "Team name is required." }
  if (!homeClubId) return { ok: false, error: "Please select a home club." }
  if (captainPlays && !playtomicUrl.trim()) return { ok: false, error: "Playtomic profile link is required when you play in the team." }

  // Guard: the chosen venue must still have a public slot available.
  const [venueCheck] = await db
    .select({ name: clubs.name, publicSlots: clubs.publicSlots, teamsEntering: clubs.teamsEntering })
    .from(clubs)
    .where(eq(clubs.id, homeClubId))
    .limit(1)
  if (!venueCheck) return { ok: false, error: "Selected venue not found." }
  const [{ publicUsed }] = await db
    .select({ publicUsed: sql<number>`count(*)::int` })
    .from(teams)
    .where(and(eq(teams.homeClubId, homeClubId), sql`${teams.teamType} != 'Club Team'`))
  if ((publicUsed ?? 0) >= (venueCheck.publicSlots ?? 0)) {
    return { ok: false, error: `${venueCheck.name} has no remaining public hosting slots. Please choose another venue.` }
  }

  const nameParts = fullName.trim().split(" ")
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(" ") || ""

  // Sign up via Better Auth — signUpEmail throws an APIError on duplicate email
  const hdrs = await headers()
  let res: Awaited<ReturnType<typeof auth.api.signUpEmail>>
  try {
    res = await auth.api.signUpEmail({
      headers: hdrs,
      body: {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/dashboard",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("already in use")) {
      return { ok: false, error: "An account with this email already exists. Please sign in instead." }
    }
    return { ok: false, error: "Could not create account. Please try again." }
  }

  if (!res?.user) return { ok: false, error: "Could not create account. The email may already be in use." }

  const userId = res.user.id

  // Ensure userMeta with captain role
  await db
    .insert(userMeta)
    .values({ userId, role: "captain" })
    .onConflictDoNothing()

  // Update user profile
  await db
    .update(user)
    .set({
      firstName,
      lastName,
      gender: captainPlays ? (captainGender ?? "male") : null,
      // Everyone who registers is a player — even non-playing captains should
      // be visible in the squad picker so they can be added to a team later.
      isPlayer: true,
      playtomicUrl: captainPlays ? playtomicUrl.trim() || null : null,
      availability: captainPlays ? "on_team" : "unavailable",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))

  // Get or create a default organisation for this captain
  const [existingOrg] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.ownerUserId, userId))
    .limit(1)

  let orgId: number
  if (existingOrg) {
    orgId = existingOrg.id
  } else {
    const slugBase = fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const [newOrg] = await db
      .insert(organisations)
      .values({
        name: `${fullName.trim()}'s Organisation`,
        slug: `${slugBase}-${Date.now()}`,
        ownerUserId: userId,
        type: "Social Group",
      })
      .returning({ id: organisations.id })
    orgId = newOrg.id
  }

  // Get current season
  const [currentSeason] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1)

  // Get home club region
  const [homeClub] = await db
    .select({ regionId: clubs.regionId, saplRegion: clubs.saplRegion })
    .from(clubs)
    .where(eq(clubs.id, homeClubId))
    .limit(1)

  // Create the team — the registrant is automatically the owner.
  // ownerName and ownerEmail are the single source of truth for the owner
  // and are written here so the Teams admin page and My Team view both
  // reflect the owner immediately after sign-up without any manual step.
  const [newTeam] = await db
    .insert(teams)
    .values({
      name: teamName.trim(),
      organisationId: orgId,
      homeClubId,
      saplRegion: homeClub?.saplRegion ?? null,
      regionId: homeClub?.regionId ?? null,
      seasonId: currentSeason?.id ?? null,
      captainUserId: userId,
      ownerEmail: email.trim().toLowerCase(),
      ownerName: fullName.trim(),
      clubPaysFees: paymentModel === "club",
      status: "pending",
    })
    .returning({ id: teams.id })

  // If captain plays, add them to the roster
  if (captainPlays) {
    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      playerId: userId,
      role: "captain",
      status: "active",
      initiatedBy: "self",
    })
  }

  // Fire-and-forget admin alert — never blocks the sign-up flow.
  const { subject, html, text } = adminNewTeamEmail({ teamName: teamName.trim(), ownerName: fullName.trim(), ownerEmail: email.trim().toLowerCase(), adminUrl: `${appBaseUrl()}/admin/teams` })
  sendEmail({ to: ADMIN_EMAIL, subject, html, text }).catch(() => {})

  revalidatePath("/dashboard")
  return { ok: true, redirectTo: "/dashboard" }
}
