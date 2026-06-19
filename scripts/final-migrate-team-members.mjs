import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  console.log("[v0] Starting final teamMembers.playerId migration...");

  // 1. Drop the playerId_new column if it exists
  try {
    await client.query('ALTER TABLE ppl_team_members DROP COLUMN IF EXISTS "playerId_new"');
    console.log("[v0] Cleaned up temporary column");
  } catch (err) {
    console.log("[v0] No cleanup needed");
  }

  // 2. Create a backup of the old playerId column
  console.log("[v0] Creating backup of old playerId column...");
  await client.query('ALTER TABLE ppl_team_members ADD COLUMN "playerId_old" integer');
  await client.query('UPDATE ppl_team_members SET "playerId_old" = "playerId"');
  console.log("[v0] Backed up old playerId");

  // 3. Create new text column for user IDs
  console.log("[v0] Creating new playerId_new column for user IDs...");
  await client.query('ALTER TABLE ppl_team_members ADD COLUMN "playerId_new" text');

  // 4. Migrate data from ppl_players table
  console.log("[v0] Migrating from ppl_players...");
  const result = await client.query(`
    UPDATE ppl_team_members tm
    SET "playerId_new" = COALESCE(p."userId", tm."playerId_old"::text)
    FROM ppl_players p
    WHERE p.id = tm."playerId_old"
  `);
  console.log(`[v0] Migrated ${result.rowCount} rows from ppl_players`);

  // 5. Fill remaining nulls with the old ID as string (fallback)
  const fillResult = await client.query(`
    UPDATE ppl_team_members
    SET "playerId_new" = "playerId_old"::text
    WHERE "playerId_new" IS NULL
  `);
  console.log(`[v0] Filled ${fillResult.rowCount} remaining rows`);

  // 6. Drop old column
  console.log("[v0] Dropping old playerId column...");
  await client.query('ALTER TABLE ppl_team_members DROP COLUMN "playerId"');
  await client.query('ALTER TABLE ppl_team_members DROP COLUMN "playerId_old"');
  console.log("[v0] Dropped old columns");

  // 7. Rename new column
  console.log("[v0] Renaming playerId_new to playerId...");
  await client.query('ALTER TABLE ppl_team_members RENAME COLUMN "playerId_new" TO "playerId"');

  // 8. Add NOT NULL constraint
  console.log("[v0] Adding NOT NULL constraint...");
  await client.query('ALTER TABLE ppl_team_members ALTER COLUMN "playerId" SET NOT NULL');

  // 9. Recreate index
  console.log("[v0] Recreating index...");
  try {
    await client.query('DROP INDEX IF EXISTS ppl_team_members_player_idx');
  } catch (err) {
    console.log("[v0] Index didn't exist");
  }
  await client.query('CREATE INDEX ppl_team_members_player_idx ON ppl_team_members("playerId")');

  console.log("[v0] Migration complete!");
  process.exit(0);
} catch (error) {
  console.error("[v0] Migration failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
