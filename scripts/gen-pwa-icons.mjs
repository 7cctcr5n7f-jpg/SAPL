import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const SRC = "/tmp/favicon-src.png"
const ICONS_DIR = "/vercel/share/v0-project/public/icons"
const PUBLIC_DIR = "/vercel/share/v0-project/public"
const APP_DIR = "/vercel/share/v0-project/app"

const BG = { r: 10, g: 10, b: 10, alpha: 1 } // #0A0A0A

await mkdir(ICONS_DIR, { recursive: true })

// The source PNG has a white margin + drop shadow around the rounded black tile.
// Trim the surrounding white so we work with the clean tile artwork.
const tile = await sharp(SRC)
  .trim({ background: "#ffffff", threshold: 40 })
  .flatten({ background: BG })
  .png()
  .toBuffer()

// The "p + ball" glyph for maskable safe zone: trim further to the black tile's
// rounded edge is fine; we render the full tile shrunk on a black bg square.

// Standard "any" icons — full tile, edge to edge.
const standard = [72, 96, 128, 144, 152, 192, 384, 512]
for (const size of standard) {
  await sharp(tile).resize(size, size, { fit: "cover" }).png().toFile(`${ICONS_DIR}/icon-${size}.png`)
}

// Maskable icons: reuse the already-clean full-bleed tile (solid black edges,
// no rounded white corners after the cover-resize) and scale it down onto a
// solid black square so Android's circular mask never clips the glyph.
async function maskable(size) {
  const inner = Math.round(size * 0.8)
  const art = await sharp(tile).resize(inner, inner, { fit: "cover" }).flatten({ background: BG }).png().toBuffer()
  const pad = Math.round((size - inner) / 2)
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, top: pad, left: pad }])
    .png()
    .toFile(`${ICONS_DIR}/icon-maskable-${size}.png`)
}
await maskable(192)
await maskable(512)

// apple-touch-icon (iOS home screen) — 180x180, opaque.
await sharp(tile).resize(180, 180, { fit: "cover" }).flatten({ background: BG }).png().toFile(`${PUBLIC_DIR}/apple-touch-icon.png`)

// App Router metadata icons
await sharp(tile).resize(512, 512, { fit: "cover" }).png().toFile(`${APP_DIR}/icon.png`)
await sharp(tile).resize(180, 180, { fit: "cover" }).flatten({ background: BG }).png().toFile(`${APP_DIR}/apple-icon.png`)

// 32/16/48 favicons
for (const size of [16, 32, 48]) {
  await sharp(tile).resize(size, size, { fit: "cover" }).png().toFile(`${ICONS_DIR}/favicon-${size}.png`)
}
await sharp(tile).resize(32, 32, { fit: "cover" }).png().toFile(`${PUBLIC_DIR}/icon-dark-32x32.png`)
await sharp(tile).resize(32, 32, { fit: "cover" }).png().toFile(`${PUBLIC_DIR}/icon-light-32x32.png`)

console.log("Icons generated")
