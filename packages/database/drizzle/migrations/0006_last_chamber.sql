ALTER TABLE "recipes" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source_recipe_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_recipe_id_recipes_id_fk" FOREIGN KEY ("source_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipes_user_id_idx" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_user_source_idx" ON "recipes" USING btree ("user_id","source_recipe_id") WHERE "recipes"."source_recipe_id" is not null;--> statement-breakpoint
-- Copy bookmarks the user does not own. Does not generate images or debit credits.
INSERT INTO "recipes" ("source_url", "raw_data", "is_curated", "source", "user_id", "source_recipe_id")
SELECT
  'ulivo-copy://' || s.user_id || '/' || s.recipe_id::text,
  r.raw_data,
  false,
  'copy',
  s.user_id,
  s.recipe_id
FROM "saved_recipes" s
JOIN "recipes" r ON r.id = s.recipe_id
WHERE r.user_id IS DISTINCT FROM s.user_id
  AND NOT EXISTS (
    SELECT 1 FROM "imports" i
    WHERE i.user_id = s.user_id AND i.recipe_id = s.recipe_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "recipes" existing
    WHERE existing.user_id = s.user_id AND existing.source_recipe_id = s.recipe_id
  );--> statement-breakpoint
INSERT INTO "recipe_translations" ("recipe_id", "locale", "content")
SELECT c.id, t.locale, t.content
FROM "recipes" c
JOIN "recipe_translations" t ON t.recipe_id = c.source_recipe_id
WHERE c.source = 'copy'
  AND NOT EXISTS (
    SELECT 1 FROM "recipe_translations" existing
    WHERE existing.recipe_id = c.id AND existing.locale = t.locale
  );--> statement-breakpoint
INSERT INTO "icons" ("kind", "key", "recipe_id", "storage_url", "prompt", "model", "status")
SELECT 'recipe', c.id::text, c.id, i.storage_url, i.prompt, i.model, i.status
FROM "recipes" c
JOIN "icons" i ON i.kind = 'recipe' AND i.key = c.source_recipe_id::text
WHERE c.source = 'copy'
  AND i.status = 'ready'
  AND i.storage_url IS NOT NULL
ON CONFLICT ("kind", "key") DO NOTHING;--> statement-breakpoint
UPDATE "saved_recipes" AS s
SET "recipe_id" = c.id
FROM "recipes" AS c
WHERE c.user_id = s.user_id
  AND c.source_recipe_id = s.recipe_id;