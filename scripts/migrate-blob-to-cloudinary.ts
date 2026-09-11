import { loadEnvConfig } from "@next/env"
import { Pool } from "pg"
import { v2 as cloudinary } from "cloudinary"

loadEnvConfig(process.cwd())

type Target = {
  tableSql: string
  pkSql: string
  urlColumnSql: string
  folder: string
  label: string
}

const TARGETS: Target[] = [
  { tableSql: '"user"', pkSql: '"id"', urlColumnSql: '"avatarUrl"', folder: "player-photos", label: "user.avatarUrl" },
  { tableSql: '"user"', pkSql: '"id"', urlColumnSql: '"image"', folder: "player-photos", label: "user.image" },
  { tableSql: "ppl_players", pkSql: "id", urlColumnSql: '"avatarUrl"', folder: "player-photos", label: "ppl_players.avatarUrl" },
  { tableSql: "ppl_teams", pkSql: "id", urlColumnSql: '"logoUrl"', folder: "teams", label: "ppl_teams.logoUrl" },
  { tableSql: "ppl_organisations", pkSql: "id", urlColumnSql: '"logoUrl"', folder: "organisations", label: "ppl_organisations.logoUrl" },
  { tableSql: "ppl_clubs", pkSql: "id", urlColumnSql: '"logoUrl"', folder: "clubs", label: "ppl_clubs.logoUrl" },
  { tableSql: "ppl_sponsors", pkSql: "id", urlColumnSql: '"logoUrl"', folder: "sponsors", label: "ppl_sponsors.logoUrl" },
  { tableSql: "ppl_news_articles", pkSql: "id", urlColumnSql: '"featuredImage"', folder: "news", label: "ppl_news_articles.featuredImage" },
]

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function normalizePublicId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9/_-]+/g, "-")
}

async function main() {
  const apply = process.argv.includes("--apply")
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="))
  const only = onlyArg ? onlyArg.slice("--only=".length).trim() : null

  requireEnv("DATABASE_URL")
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME")
  const apiKey = requireEnv("CLOUDINARY_API_KEY")
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET")

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  let migrated = 0
  let skipped = 0
  let failed = 0

  try {
    const targets = only ? TARGETS.filter((target) => target.label === only) : TARGETS
    if (only && targets.length === 0) {
      throw new Error(`Unknown --only target "${only}". Use one of: ${TARGETS.map((target) => target.label).join(", ")}`)
    }

    console.log(`[migrate-blob] Mode: ${apply ? "APPLY" : "DRY RUN"}`)
    for (const target of targets) {
      const selectSql = `
        SELECT ${target.pkSql}::text AS id, ${target.urlColumnSql} AS url
        FROM ${target.tableSql}
        WHERE ${target.urlColumnSql} IS NOT NULL
          AND ${target.urlColumnSql} <> ''
          AND ${target.urlColumnSql} LIKE '%vercel-storage.com%'
      `
      const rows = await pool.query<{ id: string; url: string }>(selectSql)
      console.log(`[migrate-blob] ${target.label}: found ${rows.rowCount} Vercel Blob URL(s)`)

      for (const row of rows.rows) {
        const publicId = normalizePublicId(`${target.folder}/${target.label}/${row.id}`)
        if (!apply) {
          console.log(`[dry-run] ${target.label}#${row.id} -> cloudinary:${publicId}`)
          skipped++
          continue
        }
        try {
          const uploaded = await cloudinary.uploader.upload(row.url, {
            folder: target.folder,
            public_id: publicId,
            overwrite: true,
            resource_type: "image",
          })
          const updateSql = `
            UPDATE ${target.tableSql}
            SET ${target.urlColumnSql} = $1
            WHERE ${target.pkSql}::text = $2
          `
          await pool.query(updateSql, [uploaded.secure_url, row.id])
          migrated++
          console.log(`[migrated] ${target.label}#${row.id}`)
        } catch (error) {
          failed++
          const message = error instanceof Error ? error.message : String(error)
          console.error(`[failed] ${target.label}#${row.id}: ${message}`)
        }
      }
    }
  } finally {
    await pool.end()
  }

  console.log(`[migrate-blob] Complete. migrated=${migrated} failed=${failed} skipped=${skipped}`)
  if (apply && failed > 0) process.exitCode = 1
}

void main()

