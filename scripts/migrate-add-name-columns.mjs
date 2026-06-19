import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  console.log('[v0] Starting migration to add name columns to user table...');

  // Check if firstName column exists
  const checkFirstName = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'firstName'
  `);

  if (checkFirstName.rows.length === 0) {
    console.log('[v0] Adding firstName column...');
    await client.query(`
      ALTER TABLE "user" ADD COLUMN "firstName" text
    `);
    console.log('[v0] Added firstName column');
  } else {
    console.log('[v0] firstName column already exists');
  }

  // Check if lastName column exists
  const checkLastName = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'lastName'
  `);

  if (checkLastName.rows.length === 0) {
    console.log('[v0] Adding lastName column...');
    await client.query(`
      ALTER TABLE "user" ADD COLUMN "lastName" text
    `);
    console.log('[v0] Added lastName column');
  } else {
    console.log('[v0] lastName column already exists');
  }

  // Populate firstName and lastName from name field if they're NULL
  console.log('[v0] Populating firstName and lastName from name field...');
  await client.query(`
    UPDATE "user"
    SET 
      "firstName" = CASE 
        WHEN "firstName" IS NULL THEN split_part(name, ' ', 1)
        ELSE "firstName"
      END,
      "lastName" = CASE
        WHEN "lastName" IS NULL THEN COALESCE(NULLIF(substring(name from position(' ' in name) + 1), ''), '')
        ELSE "lastName"
      END
    WHERE "firstName" IS NULL OR "lastName" IS NULL
  `);
  console.log('[v0] Populated name fields');

  console.log('[v0] Migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('[v0] Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
