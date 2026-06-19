// ---------------------------------------------------------------------------
// South African Padel League (SAPL) — shared constants
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "South African Padel League",
  short: "SAPL",
  accent: "#E10600",
}

export type Role = "player" | "captain" | "org_admin" | "super_admin"

export const ROLE_LABELS: Record<Role, string> = {
  player: "Player",
  captain: "Team Captain",
  org_admin: "Team Manager",
  super_admin: "Super Administrator",
}

export const ORGANISATION_TYPES = [
  "Padel Club",
  "Corporate Company",
  "Social Group",
  "Educational Institution",
  "Community Organisation",
] as const

// Team types shown on registration + the Placement Board cards.
export const TEAM_TYPES = ["Club Team", "Company Team", "Private Team"] as const
export type TeamType = (typeof TEAM_TYPES)[number]

// SAPL operating regions for the Tshwane competition.
export const SAPL_REGIONS = ["Tshwane Central", "Tshwane East", "Tshwane South", "Tshwane West"] as const
export type SaplRegion = (typeof SAPL_REGIONS)[number]

// SAPL format: one fixture occupies all 4 courts, and a venue runs two slots a
// night (17:00 + 18:30). Hosting capacity (teams a venue can home) therefore
// equals the number of courts. Venue managers may LOWER this below the court
// count but never raise it above. See `clampHostingCapacity`.
export function suggestedHostingCapacity(courts: number): number {
  return Math.max(0, Math.floor(courts || 0))
}

// Clamp a desired capacity to [0, courts]: auto-derived from courts, decreasable
// but never larger than the court count.
export function clampHostingCapacity(courts: number, desired?: number | null): number {
  const max = Math.max(0, Math.floor(courts || 0))
  if (desired == null) return max
  return Math.min(max, Math.max(0, Math.floor(desired)))
}

// ---------------------------------------------------------------------------
// Court slots
// ---------------------------------------------------------------------------
// A venue configures each of its courts as one of three modes. "team" courts
// host one of the venue's own entered teams; "public" courts are offered to a
// public team as its home venue; "none" courts do not host league fixtures.
export type CourtSlotMode = "team" | "public" | "none"

export const COURT_SLOT_MODES: { value: CourtSlotMode; label: string; description: string }[] = [
  { value: "team", label: "Enter a team", description: "Your club fields a team that plays out of this court" },
  { value: "public", label: "Public host", description: "Open this court as a home venue for a public team" },
  { value: "none", label: "No host", description: "This court is not used for league fixtures" },
]

// Build a slot array of the given length, padding/truncating an existing list
// of modes to match the court count. New slots default to "none".
export function normaliseCourtSlots(courts: number, modes?: (CourtSlotMode | string)[] | null): CourtSlotMode[] {
  const n = Math.max(0, Math.floor(courts || 0))
  const valid = new Set<CourtSlotMode>(["team", "public", "none"])
  const src = Array.isArray(modes) ? modes : []
  const out: CourtSlotMode[] = []
  for (let i = 0; i < n; i++) {
    const m = src[i]
    out.push(m && valid.has(m as CourtSlotMode) ? (m as CourtSlotMode) : "none")
  }
  return out
}

// Derive the headline counts a venue stores from its court-slot configuration.
// teamsEntering = "team" slots, publicSlots = "public" slots, and hosting
// capacity is the sum of the two (a no-host court contributes nothing).
export function deriveSlotCounts(modes: CourtSlotMode[]): {
  teamsEntering: number
  publicSlots: number
  hostingCapacity: number
  hostsThursday: boolean
} {
  const teamsEntering = modes.filter((m) => m === "team").length
  const publicSlots = modes.filter((m) => m === "public").length
  const hostingCapacity = teamsEntering + publicSlots
  return { teamsEntering, publicSlots, hostingCapacity, hostsThursday: hostingCapacity > 0 }
}

// League night fixture slots. A venue can host one fixture per slot.
export const FIXTURE_TIMESLOTS = ["17:00", "18:30"] as const
export type FixtureTimeslot = (typeof FIXTURE_TIMESLOTS)[number]
// Max fixtures a venue can host on one league night (one per slot).
export const MAX_FIXTURES_PER_VENUE_NIGHT = FIXTURE_TIMESLOTS.length

// ---------------------------------------------------------------------------
// Hosting time slots
// ---------------------------------------------------------------------------
// A SAPL fixture (tie) is 4 rubbers played on 4 courts. A venue with 4+ courts
// can run a whole fixture inside ONE league-night time slot, so it may choose
// to host at 17:00, 18:30 or both. A venue with fewer than 4 courts cannot fit
// a fixture in a single slot — it must split the 4 rubbers across 17:00 and
// 18:30 — so such venues are forced to "both" and cannot choose.
export const MIN_COURTS_FOR_TIMESLOT_CHOICE = 4

// Per-hosting-slot time choice stored against each team/public court.
export type SlotTimeslot = "17:00" | "18:30" | "both"

export const SLOT_TIMESLOT_OPTIONS: { value: SlotTimeslot; label: string }[] = [
  { value: "17:00", label: "17:00" },
  { value: "18:30", label: "18:30" },
  { value: "both", label: "Both" },
]

export function canChooseTimeslot(courts: number): boolean {
  return Math.floor(courts || 0) >= MIN_COURTS_FOR_TIMESLOT_CHOICE
}

/**
 * Build a per-court time-slot array aligned to `courtSlots`. Non-hosting courts
 * ("none") get an empty string. Hosting courts get "17:00" | "18:30" | "both".
 * When the venue cannot choose (fewer than 4 courts) every hosting court is
 * forced to "both".
 */
export function normaliseSlotTimeslots(
  courts: number,
  courtSlots: CourtSlotMode[],
  times?: (string | null)[] | null,
): string[] {
  const forced = !canChooseTimeslot(courts)
  const valid = new Set<SlotTimeslot>(["17:00", "18:30", "both"])
  const src = Array.isArray(times) ? times : []
  return courtSlots.map((mode, i) => {
    if (mode === "none") return ""
    if (forced) return "both"
    const t = src[i]
    return t && valid.has(t as SlotTimeslot) ? (t as SlotTimeslot) : "both"
  })
}

/**
 * Expand a per-court time-slot array into the distinct league-night slots the
 * venue is willing to host, ordered 17:00 then 18:30. "both" expands to both.
 */
export function deriveHostTimeslots(slotTimeslots: string[]): FixtureTimeslot[] {
  let early = false
  let late = false
  for (const t of slotTimeslots) {
    if (t === "17:00" || t === "both") early = true
    if (t === "18:30" || t === "both") late = true
  }
  const out: FixtureTimeslot[] = []
  if (early) out.push("17:00")
  if (late) out.push("18:30")
  return out
}

/** Short human label for a venue's offered timeslots ("17:00" / "18:30" / "Both"). */
export function summariseHostTimeslots(hostTimeslots: string[]): string {
  const early = hostTimeslots.includes("17:00")
  const late = hostTimeslots.includes("18:30")
  if (early && late) return "Both"
  if (early) return "17:00"
  if (late) return "18:30"
  return "—"
}

// Playoff scheduling offsets relative to the regular season.
export const REGIONAL_FINALS_GAP_DAYS = 9 // after the final league round
export const TSHWANE_MASTERS_GAP_DAYS = 7 // after the regional finals

// Divisions ordered highest -> lowest. level 1 is the top flight.
export const DIVISIONS = [
  { name: "Premier", level: 1 },
  { name: "Championship", level: 2 },
  { name: "Shield", level: 3 },
  { name: "Challenge", level: 4 },
] as const

// SAPL: 8 teams per division, single round robin = 7 league rounds.
export const TEAMS_PER_DIVISION = 8
export const REGULAR_SEASON_WEEKS = 7

// Play formats a player can opt into on the marketplace. A player's *level*
// determines their actual category — the format is just which style of doubles
// they want to play. Players can choose one or both.
export type PlayerFormat = "mixed" | "standard"

export const PLAYER_FORMATS: { value: PlayerFormat; label: string; description: string }[] = [
  { value: "standard", label: "Standard", description: "Mens or Ladies doubles" },
  { value: "mixed", label: "Mixed", description: "One man + one woman" },
]

export const PLAYER_FORMAT_LABELS: Record<PlayerFormat, string> = {
  standard: "Standard",
  mixed: "Mixed",
}

// Category eligibility matrix (League Index based)
export type CategoryRule = {
  name: string
  gender: "male" | "female" | "mixed"
  session: 1 | 2
  isFeatureCourt: boolean
  avgTeamMaxLi: number
  playerMinLi: number
  playerMaxLi: number
  sortOrder: number
}

// A team fields exactly 4 pairs (8 players): three mens pairings split by the
// pair's *average* League Index, plus one open ladies pairing (any LI average):
//   Mens Beginner     — pair average LI up to 2.5
//   Mens Intermediate — pair average LI up to 3.5
//   Mens Open         — pair average LI over 3.5 (no upper cap)
//   Ladies Open       — any LI average
export const MENS_BEGINNER_AVG_MAX = 2.5
export const MENS_INTERMEDIATE_AVG_MAX = 3.5
const LI_MAX = 7.0

export const CATEGORY_RULES: CategoryRule[] = [
  { name: "Mens Beginner", gender: "male", session: 1, isFeatureCourt: false, avgTeamMaxLi: MENS_BEGINNER_AVG_MAX, playerMinLi: 1.0, playerMaxLi: MENS_BEGINNER_AVG_MAX, sortOrder: 1 },
  { name: "Mens Intermediate", gender: "male", session: 1, isFeatureCourt: false, avgTeamMaxLi: MENS_INTERMEDIATE_AVG_MAX, playerMinLi: 1.0, playerMaxLi: MENS_INTERMEDIATE_AVG_MAX, sortOrder: 2 },
  { name: "Mens Open", gender: "male", session: 2, isFeatureCourt: true, avgTeamMaxLi: LI_MAX, playerMinLi: 1.0, playerMaxLi: LI_MAX, sortOrder: 3 },
  { name: "Ladies Open", gender: "female", session: 2, isFeatureCourt: true, avgTeamMaxLi: LI_MAX, playerMinLi: 1.0, playerMaxLi: LI_MAX, sortOrder: 4 },
]

// Pairing categories grouped by gender for the lineup UI.
export const PAIRING_LAYOUT = {
  male: { label: "Mens", categories: ["Mens Beginner", "Mens Intermediate", "Mens Open"] },
  female: { label: "Ladies", categories: ["Ladies Open"] },
} as const

// Full squad size: 4 pairs x 2 players.
export const TEAM_SQUAD_SIZE = 8

export const SA_PROVINCES = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
]

export const TSHWANE_REGIONS = [...SAPL_REGIONS]

// Scoring
export const LEAGUE_SCORING = {
  pointPerSet: 1,
  bonusForWinner: 1,
}

// TPR / ELO
export const TPR_BASE = 1000
export const TPR_CONFIG = {
  base: 1000,
  kFactor: 32,
  marginFactor: 1.75, // up to +75% K for a dominant margin of victory
  divisionFactorStep: 0.08, // each step up in division strength adds 8%
  playoffMultiplier: 1.5,
}
export const VAT_RATE = 0.15 // South African VAT

// Default per-player league join fee, VAT inclusive (R500). Used as a fallback
// when a season has no fee configured. The live amount is set per-season under
// League Control and read via getPlayerFee().
export const DEFAULT_LEAGUE_JOIN_FEE = 500

// Split a VAT-inclusive total into its ex-VAT amount and the VAT portion.
export function splitVatInclusive(total: number): { amount: number; vatAmount: number } {
  const amount = Math.round((total / (1 + VAT_RATE)) * 100) / 100
  const vatAmount = Math.round((total - amount) * 100) / 100
  return { amount, vatAmount }
}

// Back-compat alias: the per-player season fee equals the default join fee.
export const PLAYER_SEASON_FEE = DEFAULT_LEAGUE_JOIN_FEE

export const PAYMENT_PROVIDERS = ["payfast", "peach", "stripe", "netcash"] as const

export const NOTIFICATION_TYPES = [
  "team_invitation",
  "team_request",
  "registration_confirmation",
  "payment_confirmation",
  "fixture_announcement",
  "fixture_reminder",
  "result_confirmation",
  "ranking_update",
  "promotion",
  "playoff_qualification",
  "tshwane_masters_qualification",
  "dispute_outcome",
] as const
