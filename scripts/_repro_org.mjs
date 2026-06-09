import pg from "pg"
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
async function q(label, text, params) {
  try { const r = await pool.query(text, params); console.log("OK  ", label, "rows=", r.rows.length); return r.rows }
  catch (e) { console.log("FAIL", label, "->", e.message); return null }
}
const orgs = await q("orgs-with-teams", `select "organisationId" as id, count(*) c from ppl_teams group by "organisationId" order by c desc limit 3`)
console.log("orgs:", JSON.stringify(orgs))
const orgId = orgs?.[0]?.id
let teamId
if (orgId != null) {
  const teams = await q("getOrgTeams", `select t.*, d.* from ppl_teams t left join ppl_divisions d on t."divisionId"=d.id where t."organisationId"=$1 order by t.name`, [orgId])
  teamId = teams?.[0]?.id
}
const allTeams = await q("getAllTeamsForAdmin", `select t.*, d.* from ppl_teams t left join ppl_divisions d on t."divisionId"=d.id order by t.name`)
if (!teamId) teamId = allTeams?.[0]?.id
if (teamId != null) {
  await q("getStandingForTeam", `select * from ppl_standings where "teamId"=$1 limit 1`, [teamId])
  await q("matches-for-team", `select * from ppl_matches limit 1`)
}
await pool.end()
