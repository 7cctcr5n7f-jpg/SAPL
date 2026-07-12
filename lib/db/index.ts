import { drizzle } from "drizzle-orm/node-postgres"
import { loadEnvConfig } from "@next/env"
import { Pool } from "pg"
import * as schema from "./schema"

// Scripts executed outside Next.js runtime (e.g. tsx in /scripts) do not load
// .env.local automatically, so load it here before creating the pool.
if (!process.env.DATABASE_URL) {
  loadEnvConfig(process.cwd())
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })
