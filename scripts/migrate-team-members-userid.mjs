import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  console.log("[v0] Starting teamMembers.playerId migration...");

  // 1. Add temporary text column
  console.log("[v0] Adding temporary playerId_new column...");
  try {
    await client.query(`
      ALTER TABLE ppl_team_members 
      ADD COLUMN "playerId_new" text
    `);
    console.log("[v0] Created playerId_new column");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("[v0] Column playerId_new already exists");
    } else {
      throw err;
    }
  }

  // 2. Copy data from old playerId to new, joining with ppl_players table to get user IDs
  console.log("[v0] Migrating player IDs to user IDs via ppl_players...");
  await client.query(`
    UPDATE ppl_team_members tm
    SET "playerId_new" = p."userId"
    FROM ppl_players p
    WHERE p.id = tm."playerId"::integer
    AND tm."playerId_new" IS NULL
  `);
  console.log("[v0] Migrated player IDs");

  // 3. Check for unmatched players and log them
  console.log("[v0] Checking for unmatched players...");
  const result = await client.query(`
    SELECT tm.id, tm."playerId", tm."teamId" FROM ppl_team_members tm
    WHERE "playerId_new" IS NULL
  `);
  if (result.rows.length > 0) {
    console.log(`[v0] Found ${result.rows.length} unmatched players. These team members will be removed.`);
    // Delete unmatched team members
    await client.query(`
      DELETE FROM ppl_team_members
      WHERE "playerId_new" IS NULL
    `);
    console.log("[v0] Deleted unmatched team members");
  }

  // 4. Drop old playerId column
  console.log("[v0] Dropping old playerId column...");
  await client.query(`
    ALTER TABLE ppl_team_members 
    DROP COLUMN "playerId"
  `);
  console.log("[v0] Dropped old playerId column");

  // 5. Rename new column to playerId
  console.log("[v0] Renaming playerId_new to playerId...");
  await client.query(`
    ALTER TABLE ppl_team_members 
    RENAME COLUMN "playerId_new" TO "playerId"
  `);
  console.log("[v0] Renamed column to playerId");

  // 6. Set as NOT NULL
  console.log("[v0] Setting NOT NULL constraint...");
  await client.query(`
    ALTER TABLE ppl_team_members 
    ALTER COLUMN "playerId" SET NOT NULL
  `);

  // 7. Drop and recreate the index
  console.log("[v0] Recreating playerIdx index...");
  try {
    await client.query(`
      DROP INDEX IF EXISTS ppl_team_members_player_idx
    `);
  } catch (err) {
    console.log("[v0] Could not drop index:", err.message);
  }
  
  await client.query(`
    CREATE INDEX ppl_team_members_player_idx ON ppl_team_members("playerId")
  `);
  console.log("[v0] Recreated index");

  console.log("[v0] Migration complete!");
  process.exit(0);
} catch (error) {
  console.error("[v0] Migration failed:", error.message);
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
