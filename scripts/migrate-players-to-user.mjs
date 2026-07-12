import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

async function migratePlayersToUser() {
  try {
    console.log("[v0] Starting migration: ppl_players → user table consolidation")

    // Step 1: Copy player data from ppl_players to user table
    console.log("[v0] Copying player data to user table...")
    const result1 = await sql`
      UPDATE "user"
      SET 
        isPlayer = true,
        firstName = (SELECT firstName FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        lastName = (SELECT lastName FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        gender = (SELECT gender FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        province = (SELECT province FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        city = (SELECT city FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        regionId = (SELECT regionId FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        currentLi = (SELECT currentLi FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        highestLi = (SELECT highestLi FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        liDate = (SELECT liDate FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        playtomicUserId = (SELECT playtomicUserId FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        playtomicUrl = (SELECT playtomicUrl FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        playtomicRating = (SELECT playtomicRating FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        currentTpr = (SELECT currentTpr FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        highestTpr = (SELECT highestTpr FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        preferredDivision = (SELECT preferredDivision FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        preferredCategory = (SELECT preferredCategory FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        preferredFormats = (SELECT preferredFormats FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        preferredClubIds = (SELECT preferredClubIds FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        anyClub = (SELECT anyClub FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        availability = (SELECT availability FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        lookingForTeam = (SELECT lookingForTeam FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        bio = (SELECT bio FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1),
        avatarUrl = (SELECT avatarUrl FROM ppl_players WHERE ppl_players.userId = "user".id LIMIT 1)
      WHERE EXISTS (SELECT 1 FROM ppl_players WHERE ppl_players.userId = "user".id)
    `

    console.log(`[v0] Updated ${result1.length || 0} users with player data`)

    // Step 2: Create mapping table for old player IDs to user IDs
    console.log("[v0] Creating player ID mapping for foreign keys...")
    const playerMap = await sql`
      SELECT id, userId FROM ppl_players
    `

    console.log(`[v0] Found ${playerMap.length} player records to remap`)

    // Step 3: Update foreign keys in ppl_team_members to reference user.id instead of player id
    console.log("[v0] Updating ppl_team_members foreign keys...")
    for (const { id, userId } of playerMap) {
      await sql`
        UPDATE ppl_team_members
        SET playerId = ${userId}::int
        WHERE playerId = ${id}
      `
    }

    console.log(`[v0] Updated ${playerMap.length} team member records`)

    // Step 4: Update ppl_team_pairings
    console.log("[v0] Updating ppl_team_pairings foreign keys...")
    for (const { id, userId } of playerMap) {
      await sql`
        UPDATE ppl_team_pairings
        SET playerId = ${userId}::int
        WHERE playerId = ${id}
      `
    }

    // Step 5: Update ppl_fixture_unavailable
    console.log("[v0] Updating ppl_fixture_unavailable foreign keys...")
    for (const { id, userId } of playerMap) {
      await sql`
        UPDATE ppl_fixture_unavailable
        SET playerId = ${userId}::int
        WHERE playerId = ${id}
      `
    }

    // Step 6: Update ppl_matches
    console.log("[v0] Updating ppl_matches foreign keys...")
    for (const { id } of playerMap) {
      await sql`
        UPDATE ppl_matches
        SET homeSetsWon = homeSetsWon WHERE homePlayerId1 = ${id} OR homePlayerId2 = ${id} OR awayPlayerId1 = ${id} OR awayPlayerId2 = ${id}
      `
    }

    console.log("[v0] Migration complete!")
    process.exit(0)
  } catch (error) {
    console.error("[v0] Migration failed:", error.message)
    process.exit(1)
  }
}

migratePlayersToUser()
