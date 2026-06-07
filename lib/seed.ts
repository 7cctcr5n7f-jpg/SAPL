import { db } from "@/lib/db"
import {
  regions,
  organisations,
  clubs,
  seasons,
  divisions,
  teams,
  players,
  teamMembers,
  categories,
  fixtures,
  matches,
  results,
  standings,
  tprHistory,
  cpiHistory,
  sponsors,
  payments,
  notifications,
} from "@/lib/db/schema"
import {
  CATEGORY_RULES,
  DIVISIONS,
  TSHWANE_REGIONS,
  TPR_BASE,
  VAT_RATE,
} from "@/lib/constants"
import { scoreFixture, sortStandings, type StandingRow } from "@/lib/engine/scoring"
import { calculateTpr } from "@/lib/engine/tpr"
import { calculateCpi, rankCpi } from "@/lib/engine/cpi"
import { generateRoundRobin } from "@/lib/engine/playoffs"

// Deterministic PRNG so the seed is stable across runs.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260604)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min

const ORGS = [
  { name: "Tuks Padel Club", type: "Educational Institution", city: "Hatfield", region: "Pretoria East", prefix: "Tuks", names: ["Tuks Premier", "Tuks Championship", "Tuks Shield", "Tuks Challenge"] },
  { name: "BMW Padel Club", type: "Corporate Company", city: "Rosslyn", region: "Pretoria North", prefix: "BMW", names: ["BMW A", "BMW B", "BMW C", "BMW D"] },
  { name: "Centurion Social Padel", type: "Social Group", city: "Centurion", region: "Centurion", prefix: "CEN", names: ["Centurion Warriors", "Centurion Titans", "Centurion Spartans", "Centurion Vikings"] },
  { name: "Pretoria East Padel", type: "Padel Club", city: "Faerie Glen", region: "Pretoria East", prefix: "PE", names: ["PE Eagles", "PE Hawks", "PE Falcons", "PE Owls"] },
  { name: "Old East Racquet Club", type: "Padel Club", city: "Lynnwood", region: "Pretoria Old East", prefix: "OE", names: ["OE Lions", "OE Leopards", "OE Cheetahs", "OE Pumas"] },
  { name: "Northern Smash", type: "Community Organisation", city: "Montana", region: "Pretoria North", prefix: "NS", names: ["NS Vipers", "NS Cobras", "NS Mambas", "NS Pythons"] },
]

const MALE_FIRST = ["Johan", "Pieter", "Thabo", "Sipho", "Daniel", "Riaan", "Kabelo", "Andre", "Lwazi", "Marco", "Jaco", "Tshepo"]
const FEMALE_FIRST = ["Lerato", "Anel", "Naledi", "Chante", "Zanele", "Marike", "Palesa", "Ronel", "Karabo", "Lize", "Thandi", "Elmari"]
const LAST = ["van der Merwe", "Nkosi", "Botha", "Dlamini", "Pretorius", "Khumalo", "Venter", "Mokoena", "du Plessis", "Mahlangu", "Coetzee", "Ngwenya"]

async function clearAll() {
  // Order respects no FK constraints (app tables omit them) but we clear children first anyway.
  await db.delete(notifications)
  await db.delete(payments)
  await db.delete(cpiHistory)
  await db.delete(tprHistory)
  await db.delete(standings)
  await db.delete(results)
  await db.delete(matches)
  await db.delete(fixtures)
  await db.delete(teamMembers)
  await db.delete(players)
  await db.delete(teams)
  await db.delete(divisions)
  await db.delete(seasons)
  await db.delete(clubs)
  await db.delete(sponsors)
  await db.delete(categories)
  await db.delete(organisations)
  await db.delete(regions)
}

export async function runSeed() {
  await clearAll()

  // --- Regions ---
  const regionRows = await db
    .insert(regions)
    .values(TSHWANE_REGIONS.map((name) => ({ name, slug: name.toLowerCase().replace(/\s+/g, "-"), province: "Gauteng", level: "region" })))
    .returning()
  const regionByName = new Map(regionRows.map((r) => [r.name, r.id]))

  // --- Categories ---
  await db.insert(categories).values(
    CATEGORY_RULES.map((c) => ({
      name: c.name,
      gender: c.gender,
      session: c.session,
      isFeatureCourt: c.isFeatureCourt,
      avgTeamMaxLi: c.avgTeamMaxLi,
      playerMinLi: c.playerMinLi,
      playerMaxLi: c.playerMaxLi,
      sortOrder: c.sortOrder,
    })),
  )

  // --- Season ---
  const [season] = await db
    .insert(seasons)
    .values({
      name: "Tshwane 2026 Season 1",
      startDate: new Date("2026-02-03"),
      endDate: new Date("2026-03-10"),
      weeks: 5,
      status: "active",
      isCurrent: true,
    })
    .returning()

  // --- Divisions ---
  const divisionRows = await db
    .insert(divisions)
    .values(
      DIVISIONS.map((d) => ({
        seasonId: season.id,
        name: d.name,
        level: d.level,
        regionId: regionByName.get("Pretoria East") ?? null,
        maxTeams: 6,
      })),
    )
    .returning()
  const divisionByName = new Map(divisionRows.map((d) => [d.name, d]))

  // --- Organisations + clubs + teams + players ---
  type SeedTeam = { id: number; name: string; orgId: number; divisionName: string; tpr: number; players: { id: number; gender: string; li: number }[] }
  const seedTeams: SeedTeam[] = []
  const orgIds: number[] = []
  let playerCounter = 0

  for (const org of ORGS) {
    const regionId = regionByName.get(org.region) ?? null
    const [orgRow] = await db
      .insert(organisations)
      .values({
        name: org.name,
        slug: org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        type: org.type,
        description: `${org.name} — competing in the South African Padel League across multiple divisions.`,
        province: "Gauteng",
        city: org.city,
        regionId,
      })
      .returning()
    orgIds.push(orgRow.id)

    await db.insert(clubs).values({
      organisationId: orgRow.id,
      name: `${org.name} Courts`,
      address: `${org.city}, Tshwane`,
      regionId,
      courts: randInt(3, 8),
    })

    // one team per division
    for (let i = 0; i < DIVISIONS.length; i++) {
      const divisionName = DIVISIONS[i].name
      const division = divisionByName.get(divisionName)!
      const [teamRow] = await db
        .insert(teams)
        .values({
          organisationId: orgRow.id,
          name: org.names[i],
          divisionId: division.id,
          seasonId: season.id,
          regionId,
          tpr: TPR_BASE,
          highestTpr: TPR_BASE,
          status: "active",
        })
        .returning()

      // roster: 8 players (6 male across 3 pairings + 2 female open) with
      // division-appropriate LI
      const baseLi = 4.0 - DIVISIONS[i].level * 0.4 // Premier higher LI
      const roster: { id: number; gender: string; li: number }[] = []
      for (let p = 0; p < 8; p++) {
        playerCounter++
        const gender = p < 6 ? "male" : "female"
        const first = gender === "male" ? pick(MALE_FIRST) : pick(FEMALE_FIRST)
        const li = Math.round((baseLi + (rand() - 0.5)) * 10) / 10
        const liClamped = Math.min(5, Math.max(1.5, li))
        const [playerRow] = await db
          .insert(players)
          .values({
            userId: `seed-player-${playerCounter}`,
            firstName: first,
            lastName: pick(LAST),
            gender,
            province: "Gauteng",
            city: org.city,
            regionId,
            currentLi: liClamped,
            highestLi: Math.min(5, liClamped + 0.2),
            liDate: new Date("2026-01-15"),
            currentTpr: 1000 + randInt(-150, 250),
            preferredDivision: divisionName,
            availability: "rostered",
            lookingForTeam: false,
          })
          .returning()
        roster.push({ id: playerRow.id, gender, li: liClamped })
        await db.insert(teamMembers).values({
          teamId: teamRow.id,
          playerId: playerRow.id,
          role: p === 0 ? "captain" : "member",
          status: "active",
        })
      }

      seedTeams.push({ id: teamRow.id, name: org.names[i], orgId: orgRow.id, divisionName, tpr: TPR_BASE, players: roster })
    }
  }

  // --- Free agents (player marketplace) ---
  for (let i = 0; i < 12; i++) {
    playerCounter++
    const gender = i % 2 === 0 ? "male" : "female"
    const first = gender === "male" ? pick(MALE_FIRST) : pick(FEMALE_FIRST)
    const li = Math.round((2 + rand() * 2.5) * 10) / 10
    await db.insert(players).values({
      userId: `seed-free-${playerCounter}`,
      firstName: first,
      lastName: pick(LAST),
      gender,
      province: "Gauteng",
      city: pick(["Centurion", "Faerie Glen", "Lynnwood", "Montana"]),
      regionId: regionByName.get(pick(TSHWANE_REGIONS)) ?? null,
      currentLi: li,
      highestLi: Math.min(5, li + 0.3),
      liDate: new Date("2026-01-10"),
      currentTpr: null,
      preferredDivision: pick(DIVISIONS.map((d) => d.name)),
      preferredCategory: pick(CATEGORY_RULES.map((c) => c.name)),
      availability: "available",
      lookingForTeam: true,
      bio: "Looking for a competitive team for the upcoming season.",
    })
  }

  // --- Fixtures, matches, results, standings, TPR ---
  const tprByTeam = new Map<number, number>(seedTeams.map((t) => [t.id, TPR_BASE]))
  const highestTprByTeam = new Map<number, number>(seedTeams.map((t) => [t.id, TPR_BASE]))

  for (const division of divisionRows) {
    const divTeams = seedTeams.filter((t) => t.divisionName === division.name)
    const divTeamIds = divTeams.map((t) => t.id)
    const schedule = generateRoundRobin(divTeamIds)

    // standings accumulators
    const acc = new Map<number, StandingRow>(
      divTeamIds.map((id) => [
        id,
        { teamId: id, played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, points: 0, pointsDiff: 0, rank: 0, headToHead: {} },
      ]),
    )

    const orderedSchedule = [...schedule].sort((a, b) => a.week - b.week)

    for (const fx of orderedSchedule) {
      const homeTpr = tprByTeam.get(fx.homeTeamId)!
      const awayTpr = tprByTeam.get(fx.awayTeamId)!

      // Generate 6 category matches (one per match-night category)
      const matchResults = CATEGORY_RULES.map((cat) => {
        // bias by relative team strength
        const strength = 1 / (1 + Math.pow(10, (awayTpr - homeTpr) / 400))
        const homeWins = rand() < strength
        const homeSets = homeWins ? 2 : randInt(0, 1)
        const awaySets = homeWins ? randInt(0, 1) : 2
        return { category: cat.name, homeSetsWon: homeSets, awaySetsWon: awaySets }
      })

      const score = scoreFixture(matchResults)
      const winnerTeamId =
        score.winnerSide === "home" ? fx.homeTeamId : score.winnerSide === "away" ? fx.awayTeamId : null

      const [fixtureRow] = await db
        .insert(fixtures)
        .values({
          seasonId: season.id,
          divisionId: division.id,
          week: fx.week,
          homeTeamId: fx.homeTeamId,
          awayTeamId: fx.awayTeamId,
          matchDate: new Date(2026, 1, 3 + (fx.week - 1) * 7, 18, 0, 0),
          venue: "Tshwane Padel Arena",
          status: "completed",
          homePoints: score.homePoints,
          awayPoints: score.awayPoints,
          homeSetsWon: score.homeSetsWon,
          awaySetsWon: score.awaySetsWon,
          winnerTeamId,
        })
        .returning()

      // matches
      await db.insert(matches).values(
        matchResults.map((m) => {
          const cat = CATEGORY_RULES.find((c) => c.name === m.category)!
          return {
            fixtureId: fixtureRow.id,
            category: m.category,
            session: cat.session,
            isFeatureCourt: cat.isFeatureCourt,
            homeSetsWon: m.homeSetsWon,
            awaySetsWon: m.awaySetsWon,
            scoreDetail: `${m.homeSetsWon}-${m.awaySetsWon}`,
            winnerTeamId: m.homeSetsWon > m.awaySetsWon ? fx.homeTeamId : fx.awayTeamId,
          }
        }),
      )

      // approved result record
      await db.insert(results).values({
        fixtureId: fixtureRow.id,
        submittedByUserId: "seed-system",
        approvedByUserId: "seed-system",
        status: "approved",
        homePoints: score.homePoints,
        awayPoints: score.awayPoints,
        homeSetsWon: score.homeSetsWon,
        awaySetsWon: score.awaySetsWon,
        winnerTeamId,
        approvedAt: new Date(),
      })

      // standings update
      const h = acc.get(fx.homeTeamId)!
      const a = acc.get(fx.awayTeamId)!
      h.played++
      a.played++
      h.setsWon += score.homeSetsWon
      h.setsLost += score.awaySetsWon
      a.setsWon += score.awaySetsWon
      a.setsLost += score.homeSetsWon
      h.points += score.homePoints
      a.points += score.awayPoints
      h.pointsDiff += score.homePoints - score.awayPoints
      a.pointsDiff += score.awayPoints - score.homePoints
      if (score.winnerSide === "home") {
        h.wins++
        a.losses++
        h.headToHead[fx.awayTeamId] = (h.headToHead[fx.awayTeamId] ?? 0) + 1
        a.headToHead[fx.homeTeamId] = (a.headToHead[fx.homeTeamId] ?? 0) - 1
      } else if (score.winnerSide === "away") {
        a.wins++
        h.losses++
        a.headToHead[fx.homeTeamId] = (a.headToHead[fx.homeTeamId] ?? 0) + 1
        h.headToHead[fx.awayTeamId] = (h.headToHead[fx.awayTeamId] ?? 0) - 1
      }

      // TPR update via ELO
      const tprOut = calculateTpr({
        homeTpr,
        awayTpr,
        homeSetsWon: score.homeSetsWon,
        awaySetsWon: score.awaySetsWon,
        divisionLevel: division.level,
      })
      tprByTeam.set(fx.homeTeamId, tprOut.homeTpr)
      tprByTeam.set(fx.awayTeamId, tprOut.awayTpr)
      highestTprByTeam.set(fx.homeTeamId, Math.max(highestTprByTeam.get(fx.homeTeamId)!, tprOut.homeTpr))
      highestTprByTeam.set(fx.awayTeamId, Math.max(highestTprByTeam.get(fx.awayTeamId)!, tprOut.awayTpr))

      await db.insert(tprHistory).values([
        { teamId: fx.homeTeamId, tpr: tprOut.homeTpr, change: tprOut.homeChange, reason: `Week ${fx.week} fixture`, fixtureId: fixtureRow.id, seasonId: season.id },
        { teamId: fx.awayTeamId, tpr: tprOut.awayTpr, change: tprOut.awayChange, reason: `Week ${fx.week} fixture`, fixtureId: fixtureRow.id, seasonId: season.id },
      ])
    }

    // persist standings sorted
    const sorted = sortStandings([...acc.values()])
    for (const row of sorted) {
      await db.insert(standings).values({
        seasonId: season.id,
        divisionId: division.id,
        teamId: row.teamId,
        played: row.played,
        wins: row.wins,
        losses: row.losses,
        setsWon: row.setsWon,
        setsLost: row.setsLost,
        points: row.points,
        pointsDiff: row.pointsDiff,
        rank: row.rank,
      })
    }
  }

  // persist final team TPRs
  for (const t of seedTeams) {
    await db
      .update(teams)
      .set({ tpr: tprByTeam.get(t.id)!, highestTpr: highestTprByTeam.get(t.id)! })
      .where(eqTeam(t.id))
  }

  // --- CPI ---
  const orgList = ORGS.map((_, idx) => orgIds[idx])
  const cpiInputs = orgList.map((orgId) => {
    const orgTeamTprs = seedTeams.filter((t) => t.orgId === orgId).map((t) => tprByTeam.get(t.id)!)
    return { organisationId: orgId, cpi: calculateCpi(orgTeamTprs), province: "Gauteng" }
  })
  const ranked = rankCpi(cpiInputs)
  for (const r of ranked) {
    await db.update(organisations).set({ cpi: r.cpi }).where(eqOrg(r.organisationId))
    await db.insert(cpiHistory).values({
      organisationId: r.organisationId,
      cpi: r.cpi,
      rank: r.rank,
      provincialRank: r.provincialRank,
      nationalRank: r.nationalRank,
    })
  }

  // --- Sponsors ---
  await db.insert(sponsors).values([
    { name: "Nike Padel", tier: "league", website: "https://nike.com", description: "Official apparel & footwear partner of the South African Padel League.", level: "Title", contractStart: new Date("2026-01-01"), contractEnd: new Date("2026-12-31"), active: true },
    { name: "Red Bull", tier: "league", website: "https://redbull.com", description: "Official energy partner.", level: "Platinum", contractStart: new Date("2026-01-01"), contractEnd: new Date("2026-12-31"), active: true },
    { name: "Tshwane Tourism", tier: "regional", scopeId: regionByName.get("Pretoria East") ?? null, website: "#", description: "Regional partner for Pretoria East.", level: "Gold", active: true },
    { name: "BMW South Africa", tier: "organisation", scopeId: orgIds[1], website: "https://bmw.co.za", description: "Organisation sponsor for BMW Padel Club.", level: "Gold", active: true },
    { name: "Centurion Mall", tier: "team", scopeId: seedTeams.find((t) => t.name === "Centurion Warriors")?.id ?? null, website: "#", description: "Team sponsor for Centurion Warriors.", level: "Silver", active: true },
  ])

  // --- Payments (samples) ---
  const sampleAmounts = [450, 1800, 5400]
  await db.insert(payments).values([
    { type: "individual", payerUserId: "seed-player-1", playerId: null, amount: 450, vatAmount: Math.round(450 * VAT_RATE * 100) / 100, currency: "ZAR", status: "paid", provider: "payfast", invoiceNumber: "PPL-INV-1001", reference: "REG-PLAYER-1", description: "Individual player registration fee", paidAt: new Date() },
    { type: "team", teamId: seedTeams[0].id, amount: 1800, vatAmount: Math.round(1800 * VAT_RATE * 100) / 100, currency: "ZAR", status: "paid", provider: "stripe", invoiceNumber: "PPL-INV-1002", reference: "REG-TEAM-1", description: "Team season entry fee", paidAt: new Date() },
    { type: "organisation", organisationId: orgIds[0], amount: 5400, vatAmount: Math.round(5400 * VAT_RATE * 100) / 100, currency: "ZAR", status: "pending", provider: "peach", invoiceNumber: "PPL-INV-1003", reference: "REG-ORG-1", description: "Organisation multi-team package" },
  ])

  // --- Notifications (samples) ---
  await db.insert(notifications).values([
    { userId: null, type: "fixture_announcement", title: "Round 5 fixtures released", body: "The final round of the regular season is now live. Check your fixtures.", channel: "in_app", status: "sent", scope: "league", sentAt: new Date() },
    { userId: null, type: "ranking_update", title: "Rankings updated", body: "Team Power Ratings have been recalculated after Week 5.", channel: "in_app", status: "sent", scope: "league", sentAt: new Date() },
  ])

  return {
    regions: regionRows.length,
    organisations: orgIds.length,
    teams: seedTeams.length,
    divisions: divisionRows.length,
    fixturesPerDivision: 15,
  }
}

// tiny local helpers to avoid importing eq twice with table refs
import { eq } from "drizzle-orm"
function eqTeam(id: number) {
  return eq(teams.id, id)
}
function eqOrg(id: number) {
  return eq(organisations.id, id)
}
