import { neon } from "@neondatabase/serverless"
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED)
const players = await sql`
  select u.email, u."firstName", coalesce(m.role,'player') as role
  from "user" u
  left join ppl_user_meta m on m."userId" = u.id
  order by role
  limit 12`
console.log("users:", JSON.stringify(players, null, 2))
