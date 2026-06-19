import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[v0] DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrateRoles() {
  try {
    console.log("[v0] Starting role migration: league_admin → super_admin");

    // Update ppl_user_meta table
    const result = await sql`
      UPDATE ppl_user_meta 
      SET role = 'super_admin' 
      WHERE role = 'league_admin' 
      RETURNING id
    `;

    console.log(`[v0] Updated ${result.length} users in ppl_user_meta`);

    // Verify the update
    const verify = await sql`
      SELECT COUNT(*) as count FROM ppl_user_meta WHERE role = 'super_admin'
    `;

    console.log(`[v0] Total super_admin users now: ${verify[0].count}`);
    console.log("[v0] Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("[v0] Migration failed:", error.message);
    process.exit(1);
  }
}

migrateRoles();
