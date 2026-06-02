-- TENROUNDS database schema (portable / provider-agnostic Postgres)
-- ---------------------------------------------------------------------------
-- Run this once against any PostgreSQL database (Neon, Supabase, RDS, etc.)
-- to provision every table the app uses. Mirrors lib/db/schema.ts (Drizzle).
--
--   psql "$DATABASE_URL" -f lib/db/schema.sql
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS specials (
  id                      SERIAL PRIMARY KEY,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  badge                   TEXT NOT NULL DEFAULT '',
  cta_label               TEXT NOT NULL DEFAULT '',
  cta_href                TEXT NOT NULL DEFAULT '',
  image_url               TEXT NOT NULL DEFAULT '',
  show_popup              BOOLEAN NOT NULL DEFAULT TRUE,
  show_inline             BOOLEAN NOT NULL DEFAULT TRUE,
  show_bar                BOOLEAN NOT NULL DEFAULT FALSE,
  discount_percent        INTEGER NOT NULL DEFAULT 0,
  discount_membership_ids TEXT NOT NULL DEFAULT '',
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  starts_at               TIMESTAMPTZ,
  ends_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chow_winners (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  label        TEXT NOT NULL DEFAULT 'CHOW Winner',
  period       TEXT NOT NULL DEFAULT '',
  achievement  TEXT NOT NULL DEFAULT '',
  score        TEXT NOT NULL DEFAULT '',
  quote        TEXT NOT NULL DEFAULT '',
  image_url    TEXT NOT NULL DEFAULT '',
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_milestones (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  sessions   INTEGER NOT NULL DEFAULT 0,
  image_url  TEXT NOT NULL DEFAULT '',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trial_bookings (
  id                  SERIAL PRIMARY KEY,
  full_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL,
  appointment_date    TEXT NOT NULL,
  appointment_time    TEXT NOT NULL,
  agreements_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_days (
  id         SERIAL PRIMARY KEY,
  day        TEXT NOT NULL UNIQUE,
  reason     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_signups (
  id                      SERIAL PRIMARY KEY,
  membership_id           TEXT NOT NULL DEFAULT '',
  membership_type         TEXT NOT NULL DEFAULT '',
  access_type             TEXT NOT NULL DEFAULT '',
  contract_length         INTEGER NOT NULL DEFAULT 12,
  monthly_fee             INTEGER NOT NULL DEFAULT 0,
  total_contract_value    INTEGER NOT NULL DEFAULT 0,
  first_name              TEXT NOT NULL,
  surname                 TEXT NOT NULL,
  email                   TEXT NOT NULL,
  contact_number          TEXT NOT NULL,
  id_number               TEXT NOT NULL,
  emergency_contact_name  TEXT NOT NULL DEFAULT '',
  emergency_contact_number TEXT NOT NULL DEFAULT '',
  payer_type              TEXT NOT NULL DEFAULT 'member',
  account_holder_name     TEXT NOT NULL DEFAULT '',
  account_holder_id       TEXT NOT NULL DEFAULT '',
  account_holder_contact  TEXT NOT NULL DEFAULT '',
  payment_method          TEXT NOT NULL DEFAULT 'debit',
  debit_order_date        TEXT NOT NULL DEFAULT '',
  bank_account_type       TEXT NOT NULL DEFAULT '',
  bank_name               TEXT NOT NULL DEFAULT '',
  branch_name             TEXT NOT NULL DEFAULT '',
  branch_code             TEXT NOT NULL DEFAULT '',
  account_number          TEXT NOT NULL DEFAULT '',
  bank_account_holder     TEXT NOT NULL DEFAULT '',
  mandate_accepted        BOOLEAN NOT NULL DEFAULT FALSE,
  agree_terms             BOOLEAN NOT NULL DEFAULT FALSE,
  agree_cancellation      BOOLEAN NOT NULL DEFAULT FALSE,
  agree_health            BOOLEAN NOT NULL DEFAULT FALSE,
  agree_privacy           BOOLEAN NOT NULL DEFAULT FALSE,
  signature               TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'New',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
