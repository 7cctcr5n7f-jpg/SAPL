import { hash, verify } from "@node-rs/argon2";
import pg from "pg";

const newPassword = "R@ux8509";

// Hash the password using Argon2 (what Better Auth uses)
const passwordHash = await hash(newPassword);

console.log("New password hash:", passwordHash);

// Update the database
const { Client } = pg;
const client = new Client(process.env.DATABASE_URL);

await client.connect();

try {
  const res = await client.query(
    'UPDATE account SET password = $1 WHERE "userId" = (SELECT id FROM "user" WHERE email = $2)',
    [passwordHash, "roux.ruan@icloud.com"]
  );
  console.log(`✅ Updated ${res.rowCount} account(s)`);
} catch (error) {
  console.error("Error updating password:", error.message);
} finally {
  await client.end();
}
