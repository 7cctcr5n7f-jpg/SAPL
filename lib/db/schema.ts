import { pgTable, text, timestamp, boolean, serial, integer, doublePrecision, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Better Auth required tables (camelCase columns — do not rename)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// ---------------------------------------------------------------------------
// PPL platform tables (prefix: ppl_)
// No FK constraints on app tables (per stack guidance); relationships are by id.
// Roles: player | captain | org_admin | league_admin
// ---------------------------------------------------------------------------

// Per-user platform role + identity meta
export const userMeta = pgTable(
  "ppl_user_meta",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    role: text("role").notNull().default("player"),
    phone: text("phone"),
    whatsappOptIn: boolean("whatsappOptIn").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("ppl_user_meta_user_idx").on(t.userId),
  }),
)

// Regions (Tshwane sub-regions now, provinces/nations later)
export const regions = pgTable(
  "ppl_regions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    province: text("province").notNull().default("Gauteng"),
    country: text("country").notNull().default("South Africa"),
    parentRegionId: integer("parentRegionId"),
    level: text("level").notNull().default("region"), // region | province | national
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index("ppl_regions_slug_idx").on(t.slug),
  }),
)

// Organisations (parent entity owning teams)
export const organisations = pgTable(
  "ppl_organisations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: text("type").notNull().default("Padel Club"), // Padel Club | Corporate Company | Social Group | Educational Institution | Community Organisation
    description: text("description"),
    province: text("province").notNull().default("Gauteng"),
    city: text("city"),
    regionId: integer("regionId"),
    logoUrl: text("logoUrl"),
    website: text("website"),
    cpi: doublePrecision("cpi").notNull().default(0),
    ownerUserId: text("ownerUserId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index("ppl_org_slug_idx").on(t.slug),
    regionIdx: index("ppl_org_region_idx").on(t.regionId),
  }),
)

// Clubs (physical venues / sub-entities under an organisation)
export const clubs = pgTable(
  "ppl_clubs",
  {
    id: serial("id").primaryKey(),
    organisationId: integer("organisationId").notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    description: text("description"),
    address: text("address"),
    regionId: integer("regionId"),
    saplRegion: text("saplRegion"), // Tshwane Central | East | South | West
    courts: integer("courts").notNull().default(0),
    // Total teams this venue can host on a league night. Suggested from courts
    // (3-4 -> 2, 6-8 -> 4) but editable in Club/Venue Management.
    hostingCapacity: integer("hostingCapacity").notNull().default(0),
    hostsThursday: boolean("hostsThursday").notNull().default(false),
    teamsEntering: integer("teamsEntering").notNull().default(0),
    logoUrl: text("logoUrl"),
    playtomicUrl: text("playtomicUrl"),
    contactName: text("contactName"),
    contactEmail: text("contactEmail"),
    contactPhone: text("contactPhone"),
    ownerUserId: text("ownerUserId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("ppl_clubs_org_idx").on(t.organisationId),
  }),
)

// Players (linked to auth user; also marketplace profiles)
export const players = pgTable(
  "ppl_players",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    firstName: text("firstName").notNull(),
    lastName: text("lastName").notNull(),
    gender: text("gender").notNull().default("male"), // male | female
    province: text("province").notNull().default("Gauteng"),
    city: text("city"),
    regionId: integer("regionId"),
    // League Index (highest Playtomic rating in previous 6 months)
    currentLi: doublePrecision("currentLi").notNull().default(0),
    highestLi: doublePrecision("highestLi").notNull().default(0),
    liDate: timestamp("liDate"),
    // Playtomic linkage
    playtomicUserId: text("playtomicUserId"),
    playtomicUrl: text("playtomicUrl"),
    // Player's Playtomic rating, set by league admins (players are read-only).
    playtomicRating: doublePrecision("playtomicRating"),
    currentTpr: doublePrecision("currentTpr"),
    highestTpr: doublePrecision("highestTpr"),
    // Marketplace
    preferredDivision: text("preferredDivision"),
    preferredCategory: text("preferredCategory"),
    // Formats the player wants to play: subset of ["mixed", "standard"]
    preferredFormats: jsonb("preferredFormats").$type<string[]>().notNull().default([]),
    // Preferred home clubs (organisation ids). Empty + anyClub=true means "I don't mind".
    preferredClubIds: jsonb("preferredClubIds").$type<number[]>().notNull().default([]),
    anyClub: boolean("anyClub").notNull().default(true),
    availability: text("availability").notNull().default("available"), // available | unavailable | on_team
    lookingForTeam: boolean("lookingForTeam").notNull().default(true),
    bio: text("bio"),
    avatarUrl: text("avatarUrl"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("ppl_players_user_idx").on(t.userId),
    regionIdx: index("ppl_players_region_idx").on(t.regionId),
  }),
)

// Seasons
export const seasons = pgTable("ppl_seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  weeks: integer("weeks").notNull().default(7),
  status: text("status").notNull().default("draft"), // draft | validated | published
  isCurrent: boolean("isCurrent").notNull().default(false),
  // League join fee per player for this season (VAT inclusive, in Rand).
  playerFee: integer("playerFee").notNull().default(500),
  // Playoff scheduling chosen during season creation.
  regionalFinalsVenueClubId: integer("regionalFinalsVenueClubId"),
  regionalFinalsDate: timestamp("regionalFinalsDate"),
  mastersVenueClubId: integer("mastersVenueClubId"),
  mastersDate: timestamp("mastersDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Divisions
export const divisions = pgTable(
  "ppl_divisions",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("seasonId").notNull(),
    name: text("name").notNull(), // Premier | Championship | Shield | Challenge
    level: integer("level").notNull().default(4), // 1 = Premier (highest)
    regionId: integer("regionId"),
    maxTeams: integer("maxTeams").notNull().default(8),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    seasonIdx: index("ppl_divisions_season_idx").on(t.seasonId),
  }),
)

// Teams
export const teams = pgTable(
  "ppl_teams",
  {
    id: serial("id").primaryKey(),
    organisationId: integer("organisationId").notNull(),
    name: text("name").notNull(),
    teamType: text("teamType").notNull().default("Club Team"), // Club Team | Company Team | Private Team
    homeClubId: integer("homeClubId"), // venue (ppl_clubs id) this team plays out of
    saplRegion: text("saplRegion"), // denormalised from home club for fast board display
    divisionId: integer("divisionId"),
    seasonId: integer("seasonId"),
    regionId: integer("regionId"),
    captainUserId: text("captainUserId"),
    managerUserId: text("managerUserId"),
    // Cached roster aggregates (kept fresh on roster mutations).
    avgLi: doublePrecision("avgLi").notNull().default(0),
    playerCount: integer("playerCount").notNull().default(0),
    maxPlayers: integer("maxPlayers").notNull().default(8),
    tpr: doublePrecision("tpr").notNull().default(1000),
    highestTpr: doublePrecision("highestTpr").notNull().default(1000),
    logoUrl: text("logoUrl"),
    // When true the club/organisation covers entry fees for the whole team.
    // When false each player pays their own fee.
    clubPaysFees: boolean("clubPaysFees").notNull().default(true),
    status: text("status").notNull().default("active"), // active | pending | inactive
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("ppl_teams_org_idx").on(t.organisationId),
    divIdx: index("ppl_teams_div_idx").on(t.divisionId),
  }),
)

// Team members / roster (also handles invitations and join requests)
export const teamMembers = pgTable(
  "ppl_team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("teamId").notNull(),
    playerId: integer("playerId").notNull(),
    role: text("role").notNull().default("member"), // captain | member
    // status drives invite/request workflow
    status: text("status").notNull().default("active"), // active | invited | requested | declined | removed
    initiatedBy: text("initiatedBy"), // 'team' (invite) | 'player' (request)
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index("ppl_team_members_team_idx").on(t.teamId),
    playerIdx: index("ppl_team_members_player_idx").on(t.playerId),
  }),
)

// Team pairings: 2 pairs (blocks) per category, each pair has 2 player slots.
// A slot may be empty (playerId null) which is where an invite button appears.
export const teamPairings = pgTable(
  "ppl_team_pairings",
  {
    id: serial("id").primaryKey(),
    teamId: integer("teamId").notNull(),
    category: text("category").notNull(), // e.g. "Mens Beginner"
    pairIndex: integer("pairIndex").notNull().default(1), // 1 or 2 (which block)
    slotIndex: integer("slotIndex").notNull().default(1), // 1 or 2 (player in the pair)
    playerId: integer("playerId"), // null = empty slot
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index("ppl_team_pairings_team_idx").on(t.teamId),
  }),
)

// Email invites to join a team (and optionally fill a specific pairing slot).
// When the invited email registers (or already exists), they auto-join the team.
export const teamInvites = pgTable(
  "ppl_team_invites",
  {
    id: serial("id").primaryKey(),
    teamId: integer("teamId").notNull(),
    email: text("email").notNull(),
    category: text("category"), // optional target category
    pairIndex: integer("pairIndex"), // optional target block
    slotIndex: integer("slotIndex"), // optional target slot
    invitedByUserId: text("invitedByUserId"),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"), // pending | accepted | cancelled
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    acceptedAt: timestamp("acceptedAt"),
  },
  (t) => ({
    teamIdx: index("ppl_team_invites_team_idx").on(t.teamId),
    emailIdx: index("ppl_team_invites_email_idx").on(t.email),
  }),
)

// Team entries per season: which division/region a team is assigned to.
// Used to carry returning teams into the same division automatically.
export const teamEntries = pgTable(
  "ppl_team_entries",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("seasonId").notNull(),
    teamId: integer("teamId").notNull(),
    divisionId: integer("divisionId"),
    regionId: integer("regionId"),
    // Placement Board: 1-6 slot position inside a division (null = unplaced).
    slot: integer("slot"),
    sortOrder: integer("sortOrder").notNull().default(0),
    status: text("status").notNull().default("assigned"), // assigned | unassigned
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    seasonIdx: index("ppl_team_entries_season_idx").on(t.seasonId),
    teamIdx: index("ppl_team_entries_team_idx").on(t.teamId),
  }),
)

// Category eligibility configuration
export const categories = pgTable("ppl_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Mens Beginner, Mens Intermediate, etc.
  gender: text("gender").notNull(), // male | female | mixed
  session: integer("session").notNull().default(1), // 1 or 2
  isFeatureCourt: boolean("isFeatureCourt").notNull().default(false),
  avgTeamMaxLi: doublePrecision("avgTeamMaxLi").notNull(),
  playerMinLi: doublePrecision("playerMinLi").notNull(),
  playerMaxLi: doublePrecision("playerMaxLi").notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
})

// Fixtures (a match night between two teams across categories)
export const fixtures = pgTable(
  "ppl_fixtures",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("seasonId").notNull(),
    divisionId: integer("divisionId").notNull(),
    week: integer("week").notNull().default(1),
    // Nullable: a fixture is a slot-based template until teams are placed.
    homeTeamId: integer("homeTeamId"),
    awayTeamId: integer("awayTeamId"),
    // Division slot (1..maxTeams) each side represents before/while placing teams.
    homeSlot: integer("homeSlot"),
    awaySlot: integer("awaySlot"),
    matchDate: timestamp("matchDate"),
    // League night slot: "17:00" or "18:30". Balanced per team during generation.
    timeslot: text("timeslot"),
    venue: text("venue"),
    venueClubId: integer("venueClubId"), // host club (ppl_clubs id) for booking links
    // Per-fixture Playtomic booking link (clubs/admin fill this in).
    playtomicUrl: text("playtomicUrl"),
    // Per-court booking links, keyed by category (e.g. "Mens Advanced").
    // Each category rubber plays on its own court so it gets its own booking.
    courtLinks: jsonb("courtLinks").$type<Record<string, string>>().notNull().default({}),
    status: text("status").notNull().default("scheduled"), // scheduled | completed | disputed
    homePoints: integer("homePoints"),
    awayPoints: integer("awayPoints"),
    homeSetsWon: integer("homeSetsWon"),
    awaySetsWon: integer("awaySetsWon"),
    winnerTeamId: integer("winnerTeamId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    seasonIdx: index("ppl_fixtures_season_idx").on(t.seasonId),
    divIdx: index("ppl_fixtures_div_idx").on(t.divisionId),
    weekIdx: index("ppl_fixtures_week_idx").on(t.week),
  }),
)

// Players a captain has marked unavailable for a specific fixture.
export const fixtureUnavailable = pgTable(
  "ppl_fixture_unavailable",
  {
    id: serial("id").primaryKey(),
    fixtureId: integer("fixtureId").notNull(),
    teamId: integer("teamId").notNull(),
    playerId: integer("playerId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    fixtureIdx: index("ppl_fixture_unavail_fixture_idx").on(t.fixtureId),
    uniq: uniqueIndex("ppl_fixture_unavail_uniq").on(t.fixtureId, t.playerId),
  }),
)

// Matches (individual category rubbers within a fixture)
export const matches = pgTable(
  "ppl_matches",
  {
    id: serial("id").primaryKey(),
    fixtureId: integer("fixtureId").notNull(),
    category: text("category").notNull(),
    session: integer("session").notNull().default(1),
    isFeatureCourt: boolean("isFeatureCourt").notNull().default(false),
    homeSetsWon: integer("homeSetsWon").notNull().default(0),
    awaySetsWon: integer("awaySetsWon").notNull().default(0),
    scoreDetail: text("scoreDetail"), // e.g. "6-3, 4-6, 6-2"
    winnerTeamId: integer("winnerTeamId"),
    homePlayerIds: jsonb("homePlayerIds"),
    awayPlayerIds: jsonb("awayPlayerIds"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    fixtureIdx: index("ppl_matches_fixture_idx").on(t.fixtureId),
  }),
)

// Results submission / approval audit
export const results = pgTable(
  "ppl_results",
  {
    id: serial("id").primaryKey(),
    fixtureId: integer("fixtureId").notNull(),
    submittedByUserId: text("submittedByUserId"),
    approvedByUserId: text("approvedByUserId"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    homePoints: integer("homePoints").notNull().default(0),
    awayPoints: integer("awayPoints").notNull().default(0),
    homeSetsWon: integer("homeSetsWon").notNull().default(0),
    awaySetsWon: integer("awaySetsWon").notNull().default(0),
    winnerTeamId: integer("winnerTeamId"),
    payload: jsonb("payload"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    approvedAt: timestamp("approvedAt"),
  },
  (t) => ({
    fixtureIdx: index("ppl_results_fixture_idx").on(t.fixtureId),
  }),
)

// Standings
export const standings = pgTable(
  "ppl_standings",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("seasonId").notNull(),
    divisionId: integer("divisionId").notNull(),
    teamId: integer("teamId").notNull(),
    played: integer("played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    setsWon: integer("setsWon").notNull().default(0),
    setsLost: integer("setsLost").notNull().default(0),
    points: integer("points").notNull().default(0),
    pointsDiff: integer("pointsDiff").notNull().default(0),
    rank: integer("rank").notNull().default(0),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    divIdx: index("ppl_standings_div_idx").on(t.divisionId),
    teamIdx: index("ppl_standings_team_idx").on(t.teamId),
  }),
)

// TPR history (ELO snapshots)
export const tprHistory = pgTable(
  "ppl_tpr_history",
  {
    id: serial("id").primaryKey(),
    teamId: integer("teamId").notNull(),
    tpr: doublePrecision("tpr").notNull(),
    change: doublePrecision("change").notNull().default(0),
    reason: text("reason"),
    fixtureId: integer("fixtureId"),
    seasonId: integer("seasonId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index("ppl_tpr_team_idx").on(t.teamId),
  }),
)

// CPI history
export const cpiHistory = pgTable(
  "ppl_cpi_history",
  {
    id: serial("id").primaryKey(),
    organisationId: integer("organisationId").notNull(),
    cpi: doublePrecision("cpi").notNull(),
    rank: integer("rank"),
    provincialRank: integer("provincialRank"),
    nationalRank: integer("nationalRank"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("ppl_cpi_org_idx").on(t.organisationId),
  }),
)

// Sponsors
export const sponsors = pgTable(
  "ppl_sponsors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    tier: text("tier").notNull().default("league"), // league | regional | organisation | team
    scopeId: integer("scopeId"), // org id / team id / region id depending on tier
    logoUrl: text("logoUrl"),
    website: text("website"),
    description: text("description"),
    level: text("level"), // Title | Platinum | Gold | Silver | Partner
    contractStart: timestamp("contractStart"),
    contractEnd: timestamp("contractEnd"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    tierIdx: index("ppl_sponsors_tier_idx").on(t.tier),
  }),
)

// Payments / invoices
export const payments = pgTable(
  "ppl_payments",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull().default("individual"), // individual | team | organisation
    payerUserId: text("payerUserId"),
    playerId: integer("playerId"),
    teamId: integer("teamId"),
    organisationId: integer("organisationId"),
    seasonId: integer("seasonId"),
    amount: doublePrecision("amount").notNull().default(0),
    vatAmount: doublePrecision("vatAmount").notNull().default(0),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("pending"), // pending | paid | failed | refunded
    provider: text("provider"), // payfast | peach | stripe | netcash
    invoiceNumber: text("invoiceNumber"),
    reference: text("reference"),
    description: text("description"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    paidAt: timestamp("paidAt"),
  },
  (t) => ({
    payerIdx: index("ppl_payments_payer_idx").on(t.payerUserId),
    statusIdx: index("ppl_payments_status_idx").on(t.status),
  }),
)

// Notifications (in-app + WhatsApp queue)
export const notifications = pgTable(
  "ppl_notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("userId"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    channel: text("channel").notNull().default("in_app"), // in_app | whatsapp
    status: text("status").notNull().default("queued"), // queued | sent | delivered | failed
    scope: text("scope"), // broadcast | team | club | division | direct
    scopeId: integer("scopeId"),
    readAt: timestamp("readAt"),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("ppl_notifications_user_idx").on(t.userId),
  }),
)

// Disputes
export const disputes = pgTable(
  "ppl_disputes",
  {
    id: serial("id").primaryKey(),
    fixtureId: integer("fixtureId"),
    raisedByUserId: text("raisedByUserId").notNull(),
    teamId: integer("teamId"),
    type: text("type").notNull().default("result"), // result | eligibility
    status: text("status").notNull().default("open"), // open | under_review | resolved | rejected
    description: text("description").notNull(),
    evidence: text("evidence"),
    resolution: text("resolution"),
    penalty: text("penalty"),
    resolvedByUserId: text("resolvedByUserId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    resolvedAt: timestamp("resolvedAt"),
  },
  (t) => ({
    fixtureIdx: index("ppl_disputes_fixture_idx").on(t.fixtureId),
    statusIdx: index("ppl_disputes_status_idx").on(t.status),
  }),
)

// Playoffs (promotion/relegation, regional finals, Tshwane Masters)
export const playoffs = pgTable(
  "ppl_playoffs",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("seasonId").notNull(),
    type: text("type").notNull(), // promotion | regional_final | tshwane_masters
    round: text("round").notNull(), // semi_final | final | promotion_playoff
    divisionId: integer("divisionId"),
    regionId: integer("regionId"),
    homeTeamId: integer("homeTeamId"),
    awayTeamId: integer("awayTeamId"),
    homeScore: integer("homeScore"),
    awayScore: integer("awayScore"),
    winnerTeamId: integer("winnerTeamId"),
    matchDate: timestamp("matchDate"),
    timeslot: text("timeslot"),
    venue: text("venue"),
    venueClubId: integer("venueClubId"),
    // Placeholder seeding so brackets exist before standings are known.
    // Regional finals: home/away seed = division rank (1..4).
    homeSeed: integer("homeSeed"),
    awaySeed: integer("awaySeed"),
    // Tshwane Masters: home/away region whose champion fills the slot.
    homeRegionId: integer("homeRegionId"),
    awayRegionId: integer("awayRegionId"),
    // Finals: feed from the winners of the semis at these bracket positions.
    homeSourceBracket: integer("homeSourceBracket"),
    awaySourceBracket: integer("awaySourceBracket"),
    // Human label for the placeholder ("Premier 1st", "Tshwane East Champion").
    homeLabel: text("homeLabel"),
    awayLabel: text("awayLabel"),
    status: text("status").notNull().default("scheduled"), // scheduled | completed
    bracketPosition: integer("bracketPosition"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    seasonIdx: index("ppl_playoffs_season_idx").on(t.seasonId),
    typeIdx: index("ppl_playoffs_type_idx").on(t.type),
  }),
)

// Audit log
export const auditLog = pgTable("ppl_audit_log", {
  id: serial("id").primaryKey(),
  actorUserId: text("actorUserId"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: integer("entityId"),
  detail: jsonb("detail"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
