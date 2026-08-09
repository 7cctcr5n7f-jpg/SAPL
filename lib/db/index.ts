import { drizzle } from "drizzle-orm/node-postgres"
import { loadEnvConfig } from "@next/env"
import { Pool } from "pg"
import * as schema from "./schema"

// Scripts executed outside Next.js runtime (e.g. tsx in /scripts) do not load
// .env.local automatically, so load it here before creating the pool.
if (!process.env.DATABASE_URL) {
  loadEnvConfig(process.cwd())
}

let poolInstance: Pool | null = null
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null

function normalizedDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  try {
    const url = new URL(raw)
    const sslmode = url.searchParams.get("sslmode")
    if (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca") {
      // Keep today's strict behavior explicit and future-proof against pg v9 changes.
      url.searchParams.set("sslmode", "verify-full")
      return url.toString()
    }
    return raw
  } catch {
    return raw
  }
}

export function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: normalizedDatabaseUrl(process.env.DATABASE_URL),
    })
  }
  return poolInstance
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema })
  }
  return dbInstance
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return Reflect.get(getPool(), prop)
  },
}) as Pool

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop)
  },
}) as ReturnType<typeof getDb>
