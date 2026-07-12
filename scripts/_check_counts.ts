import { db } from "@/lib/db"
import { teams, teamMembers } from "@/lib/db/schema"
import { eq, count, and, inArray } from "drizzle-orm"
import { TEAM_VISIBLE_STATUSES } from "@/lib/team-lifecycle"

async function main() {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      playerCount: teams.playerCount,
      maxPlayers: teams.maxPlayers,
      actual: count(teamMembers.playerId),
    })
    .from(teams)
    .leftJoin(teamMembers, and(eq(teamMembers.teamId, teams.id), eq(teamMembers.status, "active")))
    .where(inArray(teams.status, [...TEAM_VISIBLE_STATUSES]))
    .groupBy(teams.id, teams.name, teams.playerCount, teams.maxPlayers)
    .limit(10)

  console.log(JSON.stringify(rows, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
