import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

test("fixture revalidation helper does not call itself recursively", () => {
  const filePath = path.join(process.cwd(), "lib/actions/fixtures.ts")
  const src = fs.readFileSync(filePath, "utf8")
  const match = src.match(/function revalidateFixtureSurfaces\(\)\s*\{([\s\S]*?)\n\}/)

  assert.ok(match, "revalidateFixtureSurfaces function must exist")
  const body = match[1]

  assert.equal(
    /revalidateFixtureSurfaces\(\)/.test(body),
    false,
    "revalidate helper must not call itself",
  )
  assert.ok(/revalidateTag\("league-centre-shared"\)/.test(body), "league-centre cache tag revalidation must remain")
})
