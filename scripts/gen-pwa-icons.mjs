import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const SRC = "/tmp/favicon-src.png"
const ICONS_DIR = "/vercel/share/v0-project/public/icons"
const PUBLIC_DIR = "/vercel/share/v0-project/public"
const APP_DIR = "/vercel/share/v0-project/app"

const BG = { r: 10, g: 10, b: 10, alpha: 1 } // #0A0A0A

await mkdir(ICONS_DIR, { recursive: true })

// Standard "any" icons — the source already has padding/rounded tile, use as-is.
const standard = [72, 96, 128, 144, 152, 192, 384, 512]
for (const size of standard) {
  await sharp(SRC).resize(size, size, { fit: "cover" }).png().toFile(`${ICONS_DIR}/icon-${size}.png`)
}

// Maskable icons need ~80% safe zone — shrink the artwork onto a solid bg square.
async function maskable(size) {
  const inner = Math.round(size * 0.8)
  const art = await sharp(SRC).resize(inner, inner, { fit: "contain", background: BG }).png().toBuffer()
  const pad = Math.round((size - inner) / 2)
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, top: pad, left: pad }])
    .png()
    .toFile(`${ICONS_DIR}/icon-maskable-${size}.png`)
}
await maskable(192)
await maskable(512)

// apple-touch-icon (iOS home screen) — 180x180, no transparency.
await sharp(SRC).resize(180, 180, { fit: "cover" }).flatten({ background: BG }).png().toFile(`${PUBLIC_DIR}/apple-touch-icon.png`)

// App Router metadata icons
await sharp(SRC).resize(512, 512, { fit: "cover" }).png().toFile(`${APP_DIR}/icon.png`)
await sharp(SRC).resize(180, 180, { fit: "cover" }).flatten({ background: BG }).png().toFile(`${APP_DIR}/apple-icon.png`)

// 32x32 favicons (light + dark variants both use the tile)
await sharp(SRC).resize(32, 32, { fit: "cover" }).png().toFile(`${PUBLIC_DIR}/icon-dark-32x32.png`)
await sharp(SRC).resize(32, 32, { fit: "cover" }).png().toFile(`${PUBLIC_DIR}/icon-light-32x32.png`)

console.log("Icons generated")
