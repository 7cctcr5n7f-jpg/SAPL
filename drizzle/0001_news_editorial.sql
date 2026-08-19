CREATE TABLE IF NOT EXISTS "ppl_news_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ppl_news_categories_slug_uidx"
  ON "ppl_news_categories" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "ppl_news_categories_name_idx"
  ON "ppl_news_categories" USING btree ("name");

CREATE TABLE IF NOT EXISTS "ppl_news_articles" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "excerpt" text,
  "content" text DEFAULT '' NOT NULL,
  "featuredImage" text,
  "featuredImageAlt" text,
  "categoryId" integer,
  "authorName" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "publishedAt" timestamp,
  "metaTitle" text,
  "metaDescription" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "readTime" integer,
  "createdByUserId" text,
  "updatedByUserId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ppl_news_articles_slug_uidx"
  ON "ppl_news_articles" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "ppl_news_articles_status_idx"
  ON "ppl_news_articles" USING btree ("status");
CREATE INDEX IF NOT EXISTS "ppl_news_articles_featured_idx"
  ON "ppl_news_articles" USING btree ("featured");
CREATE INDEX IF NOT EXISTS "ppl_news_articles_category_idx"
  ON "ppl_news_articles" USING btree ("categoryId");
CREATE INDEX IF NOT EXISTS "ppl_news_articles_published_at_idx"
  ON "ppl_news_articles" USING btree ("publishedAt");
