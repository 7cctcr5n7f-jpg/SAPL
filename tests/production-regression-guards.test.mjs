import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8")
}

test("league centre keeps published-fixture visibility gate", () => {
  const src = read("lib/queries-league-centre.ts")
  assert.ok(
    src.includes("where(and(eq(fixtures.seasonId, season.id), eq(fixtures.published, true), inArray(fixtures.divisionId, usedDivisionIds)))"),
  )
  assert.ok(src.includes(".where(and(eq(fixtures.id, fixtureId), eq(fixtures.published, true)))"))
})

test("fixture category time save validation remains HH:MM", () => {
  const src = read("lib/actions/fixtures.ts")
  assert.ok(src.includes("const time = timeRaw && /^\\d{1,2}:\\d{2}$/.test(timeRaw) ? timeRaw : timeRaw || null"))
})

test("payment initiation still targets PayFast ITN route", () => {
  const src = read("lib/actions/payments.ts")
  assert.ok(src.includes("notifyUrl: `${notifyBase}/api/payfast/notify`"))
  assert.ok(src.includes("const url = buildPayFastUrl({"))
})

test("fixture export keeps expected time/booking columns", () => {
  const src = read("components/fixtures/ops-console.tsx")
  assert.ok(src.includes('"Fixture Time"'))
  assert.ok(src.includes('"Booking Link"'))
  assert.ok(src.includes("assignment?.time ?? fixture.timeslot ?? \"\""))
})
