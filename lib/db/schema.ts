import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const specials = pgTable('specials', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  badge: text('badge').notNull().default(''),
  ctaLabel: text('cta_label').notNull().default(''),
  ctaHref: text('cta_href').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  showPopup: boolean('show_popup').notNull().default(true),
  showInline: boolean('show_inline').notNull().default(true),
  showBar: boolean('show_bar').notNull().default(false),
  // Optional membership discount: percent off applied to the selected memberships
  discountPercent: integer('discount_percent').notNull().default(0),
  // Comma-separated membership IDs the discount applies to (see lib/memberships.ts)
  discountMembershipIds: text('discount_membership_ids').notNull().default(''),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chowWinners = pgTable('chow_winners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  label: text('label').notNull().default('CHOW Winner'),
  period: text('period').notNull().default(''),
  achievement: text('achievement').notNull().default(''),
  // The winner's score for the week's challenge (e.g. "221")
  score: text('score').notNull().default(''),
  quote: text('quote').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Single key/value rows for editable site copy (e.g. the weekly CHOW challenge)
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Weekly session-milestone celebration (100/200/300/400/500 sessions) shown on the members page
export const sessionMilestones = pgTable('session_milestones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sessions: integer('sessions').notNull().default(0),
  imageUrl: text('image_url').notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Native free-trial bookings submitted from /free-trial
export const trialBookings = pgTable('trial_bookings', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  // Booking date stored as an ISO date string (YYYY-MM-DD) and time as "HH:mm"
  // — portable across any Postgres provider, no timezone surprises.
  appointmentDate: text('appointment_date').notNull(),
  appointmentTime: text('appointment_time').notNull(),
  agreementsAccepted: boolean('agreements_accepted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Days the studio is closed / unavailable for trials (e.g. public holidays).
// Stored as 'YYYY-MM-DD' text to match appointmentDate and avoid TZ surprises.
export const blockedDays = pgTable('blocked_days', {
  id: serial('id').primaryKey(),
  day: text('day').notNull().unique(),
  reason: text('reason').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Native membership signups submitted from /signup
export const membershipSignups = pgTable('membership_signups', {
  id: serial('id').primaryKey(),
  // ── Selected membership ──
  membershipId: text('membership_id').notNull().default(''),
  membershipType: text('membership_type').notNull().default(''), // access tier name (e.g. "Anytime Access")
  accessType: text('access_type').notNull().default(''), // membership name (e.g. "Unlimited")
  contractLength: integer('contract_length').notNull().default(12), // months
  monthlyFee: integer('monthly_fee').notNull().default(0),
  totalContractValue: integer('total_contract_value').notNull().default(0),
  // ── Member details ──
  firstName: text('first_name').notNull(),
  surname: text('surname').notNull(),
  email: text('email').notNull(),
  contactNumber: text('contact_number').notNull(),
  idNumber: text('id_number').notNull(),
  emergencyContactName: text('emergency_contact_name').notNull().default(''),
  emergencyContactNumber: text('emergency_contact_number').notNull().default(''),
  // ── Payment details ──
  payerType: text('payer_type').notNull().default('member'), // 'member' | 'other'
  accountHolderName: text('account_holder_name').notNull().default(''),
  accountHolderId: text('account_holder_id').notNull().default(''),
  accountHolderContact: text('account_holder_contact').notNull().default(''),
  paymentMethod: text('payment_method').notNull().default('debit'), // 'debit' | 'cash'
  debitOrderDate: text('debit_order_date').notNull().default(''), // '1st' | 'last'
  bankAccountType: text('bank_account_type').notNull().default(''), // 'cheque' | 'savings'
  bankName: text('bank_name').notNull().default(''),
  branchName: text('branch_name').notNull().default(''),
  branchCode: text('branch_code').notNull().default(''),
  accountNumber: text('account_number').notNull().default(''),
  bankAccountHolder: text('bank_account_holder').notNull().default(''),
  // ── Agreements ──
  mandateAccepted: boolean('mandate_accepted').notNull().default(false),
  agreeTerms: boolean('agree_terms').notNull().default(false),
  agreeCancellation: boolean('agree_cancellation').notNull().default(false),
  agreeHealth: boolean('agree_health').notNull().default(false),
  agreePrivacy: boolean('agree_privacy').notNull().default(false),
  // ── Signature (PNG data URL) ──
  signature: text('signature').notNull().default(''),
  // ── Workflow ──
  status: text('status').notNull().default('New'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Special = typeof specials.$inferSelect
export type ChowWinner = typeof chowWinners.$inferSelect
export type SettingRow = typeof settings.$inferSelect
export type SessionMilestone = typeof sessionMilestones.$inferSelect
export type TrialBooking = typeof trialBookings.$inferSelect
export type BlockedDay = typeof blockedDays.$inferSelect
export type MembershipSignup = typeof membershipSignups.$inferSelect
