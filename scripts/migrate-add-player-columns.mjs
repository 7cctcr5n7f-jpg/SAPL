import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  console.log('[v0] Starting migration: adding player columns to user table');

  // Check if columns exist before adding them
  const result = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'user' 
    AND column_name IN ('isPlayer', 'onMarketplace')
  `);

  const existingCols = result.rows?.map(r => r.column_name) || [];
  
  // Add isPlayer column if it doesn't exist
  if (!existingCols.includes('isPlayer')) {
    await client.query(`
      ALTER TABLE "user" 
      ADD COLUMN "isPlayer" boolean NOT NULL DEFAULT false
    `);
    console.log('[v0] Added isPlayer column');
  }

  // Add onMarketplace column if it doesn't exist
  if (!existingCols.includes('onMarketplace')) {
    await client.query(`
      ALTER TABLE "user" 
      ADD COLUMN "onMarketplace" boolean NOT NULL DEFAULT false
    `);
    console.log('[v0] Added onMarketplace column');
  }

  // Add other player profile columns
  const otherCols = [
    'firstName',
    'lastName',
    'gender',
    'province',
    'city',
    'regionId',
    'currentLi',
    'highestLi',
    'liDate',
    'playtomicUserId',
    'playtomicUrl',
    'playtomicRating',
    'currentTpr',
    'highestTpr',
    'preferredDivision',
    'preferredCategory',
    'preferredFormats',
    'preferredClubIds',
    'anyClub',
    'availability',
    'lookingForTeam',
    'bio',
    'avatarUrl'
  ];

  for (const col of otherCols) {
    if (!existingCols.includes(col)) {
      // Determine column type and constraints
      let colDef = '';
      
      if (col === 'firstName' || col === 'lastName') {
        colDef = `text`;
      } else if (col === 'gender') {
        colDef = `text DEFAULT 'male'`;
      } else if (col === 'province') {
        colDef = `text DEFAULT 'Gauteng'`;
      } else if (col === 'city' || col === 'playtomicUserId' || col === 'playtomicUrl' || col === 'preferredDivision' || col === 'preferredCategory' || col === 'bio' || col === 'avatarUrl') {
        colDef = `text`;
      } else if (col === 'regionId') {
        colDef = `integer`;
      } else if (col === 'currentLi' || col === 'highestLi' || col === 'playtomicRating' || col === 'currentTpr' || col === 'highestTpr') {
        colDef = `double precision DEFAULT 0`;
      } else if (col === 'liDate') {
        colDef = `timestamp`;
      } else if (col === 'preferredFormats' || col === 'preferredClubIds') {
        colDef = `jsonb DEFAULT '[]'`;
      } else if (col === 'anyClub' || col === 'lookingForTeam') {
        colDef = `boolean DEFAULT true`;
      } else if (col === 'availability') {
        colDef = `text DEFAULT 'available'`;
      }

      if (colDef) {
        try {
          await client.query(`
            ALTER TABLE "user" 
            ADD COLUMN "${col}" ${colDef}
          `);
          console.log(`[v0] Added ${col} column`);
        } catch (err) {
          console.log(`[v0] Column ${col} already exists or error occurred: ${err.message}`);
        }
      }
    }
  }

  console.log('[v0] Migration completed successfully');
  process.exit(0);
} catch (error) {
  console.error('[v0] Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
