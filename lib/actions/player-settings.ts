"use server"

import { db } from "@/lib/db"
import { user as user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { revalidatePath } from "next/cache"

export async function updatePlayerSettings(input: {
  isPlayer: boolean
  onMarketplace: boolean
}) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")

  // If user is on a team, they cannot be on the marketplace
  if (input.onMarketplace && user.role === "player") {
    // Check if user has an active team membership
    const { teamMembers } = await import("@/lib/db/schema")
    const [teamMembership] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.playerId, user.id))
      .limit(1)

    if (teamMembership) {
      return { 
        ok: false, 
        error: "You cannot be on the marketplace while you are part of a team. Leave your team first." 
      }
    }
  }

  await db
    .update(user)
    .set({
      isPlayer: input.isPlayer,
      onMarketplace: input.isPlayer && input.onMarketplace, // Can only be on marketplace if a player
      updatedAt: new Date(),
    })
    .where(eq(user.id, user.id))

  revalidatePath("/dashboard/profile")
  revalidatePath("/marketplace")

  return { ok: true }
}
