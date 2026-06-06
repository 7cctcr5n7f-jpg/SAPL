// ---------------------------------------------------------------------------
// South African Padel League (SAPL) — shared constants
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "South African Padel League",
  short: "SAPL",
  accent: "#E10600",
}

export type Role = "player" | "captain" | "org_admin" | "league_admin" | "super_admin"

export const ROLE_LABELS: Record<Role, string> = {
  player: "Player",
  captain: "Team Captain",
  org_admin: "Team Manager",
  league_admin: "League Administrator",
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

// League night fixture slots. A venue can host one fixture per slot.
export const FIXTURE_TIMESLOTS = ["17:00", "18:30"] as const
export type FixtureTimeslot = (typeof FIXTURE_TIMESLOTS)[number]
// Max fixtures a venue can host on one league night (one per slot).
export const MAX_FIXTURES_PER_VENUE_NIGHT = FIXTURE_TIMESLOTS.length

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

// A team fields exactly 4 pairs (8 players): a beginner + advanced pair for each
// gender. The LI boundary splits beginner from advanced:
//   Ladies — beginner up to 2.5 LI, advanced over 2.5 LI
//   Mens   — beginner up to 3.0 LI, advanced over 3.0 LI
export const LADIES_LI_SPLIT = 2.5
export const MENS_LI_SPLIT = 3.0
const LI_MAX = 7.0

export const CATEGORY_RULES: CategoryRule[] = [
  { name: "Ladies Beginner", gender: "female", session: 1, isFeatureCourt: false, avgTeamMaxLi: LADIES_LI_SPLIT, playerMinLi: 1.0, playerMaxLi: LADIES_LI_SPLIT, sortOrder: 1 },
  { name: "Ladies Advanced", gender: "female", session: 1, isFeatureCourt: true, avgTeamMaxLi: LI_MAX, playerMinLi: LADIES_LI_SPLIT, playerMaxLi: LI_MAX, sortOrder: 2 },
  { name: "Mens Beginner", gender: "male", session: 1, isFeatureCourt: false, avgTeamMaxLi: MENS_LI_SPLIT, playerMinLi: 1.0, playerMaxLi: MENS_LI_SPLIT, sortOrder: 3 },
  { name: "Mens Advanced", gender: "male", session: 1, isFeatureCourt: true, avgTeamMaxLi: LI_MAX, playerMinLi: MENS_LI_SPLIT, playerMaxLi: LI_MAX, sortOrder: 4 },
]

// Pairing categories grouped by gender for the two-column lineup UI.
export const PAIRING_LAYOUT = {
  female: { label: "Ladies", categories: ["Ladies Beginner", "Ladies Advanced"] },
  male: { label: "Mens", categories: ["Mens Beginner", "Mens Advanced"] },
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
