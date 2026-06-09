import { getOrgTeams, getAllTeamsForAdmin, getStandingForTeam, getTeamPairingData, getCategories } from "@/lib/queries-dashboard"
import { getClubsWithUsage } from "@/lib/queries-clubs"
import { getPlayerFee } from "@/lib/queries"
import { isSeasonLocked } from "@/lib/season-lock"

async function main() {
  const orgId = 8
  const cats = await getCategories(); const catNames = cats.map((c) => c.name)
  console.log("getCategories OK", catNames.length)
  const teams = await getOrgTeams(orgId); console.log("getOrgTeams OK", teams.length)
  await getAllTeamsForAdmin(); console.log("getAllTeamsForAdmin OK")
  await getClubsWithUsage(); console.log("getClubsWithUsage OK")
  await getPlayerFee(); console.log("getPlayerFee OK")
  await isSeasonLocked(); console.log("isSeasonLocked OK")
  for (const row of teams) {
    await getStandingForTeam(row.team.id)
    await getTeamPairingData(row.team.id, catNames)
  }
  console.log("per-team loop OK for", teams.length, "teams")
}
main().then(() => process.exit(0)).catch((e) => { console.error("THROWN:", e.message); process.exit(1) })
