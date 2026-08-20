ALTER TABLE "ppl_fixtures"
  ALTER COLUMN "homePoints" TYPE double precision USING "homePoints"::double precision,
  ALTER COLUMN "awayPoints" TYPE double precision USING "awayPoints"::double precision;

ALTER TABLE "ppl_results"
  ALTER COLUMN "homePoints" TYPE double precision USING "homePoints"::double precision,
  ALTER COLUMN "awayPoints" TYPE double precision USING "awayPoints"::double precision;

ALTER TABLE "ppl_standings"
  ALTER COLUMN "points" TYPE double precision USING "points"::double precision;
