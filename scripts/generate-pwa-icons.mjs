import sharp from "sharp"
import { mkdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const iconsDir = path.join(root, "public", "icons")
// Read sources into buffers so we can safely overwrite same-named outputs.
const source = await readFile(path.join(iconsDir, "icon-512.png"))
const maskableSource = await readFile(path.join(iconsDir, "icon-maskable-512.png"))

await mkdir(iconsDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const BG = "#0A0A0A"

for (const size of sizes) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(path.join(iconsDir, `icon-${size}.png`))
}

// Maskable variants used by Android adaptive icons.
for (const size of [192, 512]) {
  await sharp(maskableSource)
    .resize(size, size, { fit: "cover", background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(path.join(iconsDir, `icon-maskable-${size}.png`))
}

// Apple touch icon (180x180, no transparency).
await sharp(source)
  .resize(180, 180, { fit: "contain", background: BG })
  .flatten({ background: BG })
  .png()
  .toFile(path.join(root, "public", "apple-touch-icon.png"))

// Favicon-sized assets.
for (const size of [16, 32, 48]) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(path.join(iconsDir, `favicon-${size}.png`))
}

console.log("PWA icons generated.")
