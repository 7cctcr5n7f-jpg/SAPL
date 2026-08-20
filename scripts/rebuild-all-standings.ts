// One-off script: rebuild standings for every division in the current season
// using the corrected scoreFixture logic (points-based win/draw/loss).
import { db } from "@/lib/db"
import { divisions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentSeason } from "@/lib/queries"
import { rebuildDivisionStandings } from "@/lib/engine/apply-result"

async function main() {
  const season = await getCurrentSeason()
  if (!season) {
    console.log("No season found.")
    return
  }
  const divisionRows = await db
    .select({ id: divisions.id, name: divisions.name })
    .from(divisions)
    .where(eq(divisions.seasonId, season.id))

  console.log(`Rebuilding standings for season ${season.id} (${season.name}), ${divisionRows.length} divisions`)
  for (const division of divisionRows) {
    await rebuildDivisionStandings(division.id, season.id)
    console.log(`  ✓ ${division.name} (id=${division.id})`)
  }
  console.log("Done.")
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
