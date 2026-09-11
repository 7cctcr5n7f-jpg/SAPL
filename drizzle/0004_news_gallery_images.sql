ALTER TABLE "ppl_news_articles"
ADD COLUMN IF NOT EXISTS "galleryImages" jsonb DEFAULT '[]'::jsonb NOT NULL;
