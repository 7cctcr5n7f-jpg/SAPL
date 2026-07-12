/**
 * Seeds test players across the four SAPL competition bands so the marketplace,
 * rankings and roster tools have realistic data to work with.
 *
 *   Beginner Men     50 players   LI 1.00 – 2.49
 *   Intermediate Men 50 players   LI 2.50 – 3.49
 *   Open Men         50 players   LI 3.50 – 6.00
 *   Open Women       30 players   LI 0.50 – 4.00
 *
 * Each player gets a first name, last name, gender and LI rating. Players are
 * inserted as available free agents (lookingForTeam = true). The script is
 * idempotent: it deletes any previously seeded test players (userId prefix
 * "seed-test-") before inserting a fresh batch.
 *
 * Run with:
 *   set -a && source /vercel/share/.env.project && set +a && npx tsx scripts/seed-test-players.ts
 */
import { db } from "@/lib/db"
import { players } from "@/lib/db/schema"
import { like } from "drizzle-orm"

// Deterministic PRNG so repeated runs produce the same roster.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(2026_06_09)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
// Random LI within [min, max], rounded to 2 decimals.
const li = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100

const MALE_FIRST = [
  "Johan", "Pieter", "Thabo", "Sipho", "Daniel", "Riaan", "Kabelo", "Andre", "Lwazi", "Marco",
  "Jaco", "Tshepo", "Bongani", "Werner", "Dewald", "Katlego", "Ruan", "Mandla", "Cobus", "Sizwe",
  "Henk", "Lebo", "Francois", "Themba", "Stefan", "Vusi", "Morne", "Tumelo", "Gerhard", "Musa",
]
const FEMALE_FIRST = [
  "Lerato", "Anel", "Naledi", "Chante", "Zanele", "Marike", "Palesa", "Ronel", "Karabo", "Lize",
  "Thandi", "Elmari", "Nomvula", "Suzaan", "Refilwe", "Carike", "Dineo", "Mariska", "Boitumelo", "Anke",
]
const LAST = [
  "van der Merwe", "Nkosi", "Botha", "Dlamini", "Pretorius", "Khumalo", "Venter", "Mokoena", "du Plessis",
  "Mahlangu", "Coetzee", "Ngwenya", "Steyn", "Mthembu", "Joubert", "Sithole", "Fourie", "Zulu", "Le Roux",
  "Maluleke", "Naidoo", "Pillay", "Govender", "Erasmus", "Molefe", "Smit", "Radebe", "Nel", "Tshabalala", "Viljoen",
]
const CITIES = ["Centurion", "Faerie Glen", "Lynnwood", "Montana", "Hatfield", "Rosslyn", "Garsfontein", "Menlyn"]

type Band = {
  key: string
  label: string
  gender: "male" | "female"
  count: number
  liMin: number
  liMax: number
  preferredCategory: string
}

const BANDS: Band[] = [
  { key: "beginner-men", label: "Beginner Men", gender: "male", count: 50, liMin: 1.0, liMax: 2.49, preferredCategory: "Mens Beginner" },
  { key: "intermediate-men", label: "Intermediate Men", gender: "male", count: 50, liMin: 2.5, liMax: 3.49, preferredCategory: "Mens Intermediate" },
  { key: "open-men", label: "Open Men", gender: "male", count: 50, liMin: 3.5, liMax: 6.0, preferredCategory: "Mens Open" },
  { key: "open-women", label: "Open Women", gender: "female", count: 30, liMin: 0.5, liMax: 4.0, preferredCategory: "Ladies Open" },
]

async function run() {
  // Idempotent: clear previously seeded test players.
  const deleted = await db.delete(players).where(like(user.id, "seed-test-%")).returning({ id: user.id })
  console.log(`[seed-test-players] removed ${deleted.length} existing test players`)

  let counter = 0
  const summary: Record<string, number> = {}

  for (const band of BANDS) {
    const rows = Array.from({ length: band.count }, () => {
      counter++
      const first = band.gender === "male" ? pick(MALE_FIRST) : pick(FEMALE_FIRST)
      const rating = li(band.liMin, band.liMax)
      return {
        userId: `seed-test-${band.key}-${counter}`,
        firstName: first,
        lastName: pick(LAST),
        gender: band.gender,
        province: "Gauteng",
        city: pick(CITIES),
        currentLi: rating,
        highestLi: Math.round(Math.min(band.liMax, rating + rand() * 0.3) * 100) / 100,
        liDate: new Date("2026-01-15"),
        preferredCategory: band.preferredCategory,
        availability: "available" as const,
        lookingForTeam: true,
        bio: `${band.label} player looking for a competitive team this season.`,
      }
    })

    // chunked insert to stay within parameter limits
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(players).values(rows.slice(i, i + 50))
    }
    summary[band.label] = rows.length
    console.log(`[seed-test-players] inserted ${rows.length} ${band.label} (LI ${band.liMin}–${band.liMax})`)
  }

  return { total: counter, byBand: summary }
}

run()
  .then((s) => {
    console.log("[seed-test-players] complete:", JSON.stringify(s))
    process.exit(0)
  })
  .catch((err) => {
    console.error("[seed-test-players] failed:", err)
    process.exit(1)
  })
