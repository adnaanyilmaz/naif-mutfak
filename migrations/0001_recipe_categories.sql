-- Data-only migration: recipe categories move from `bread` / `pastry` to the 12 slugs
-- defined in src/services/content/category.ts. The column stays free text; no schema change.
-- The seeded baklava post is a dessert, not a "poğaça, açma & çörek".
UPDATE `posts` SET `category` = 'tatlilar' WHERE `id` = '7b0c6c1e-0a51-4c39-9a3e-5f1d2c9e1a02' AND `category` = 'pastry';--> statement-breakpoint
UPDATE `posts` SET `category` = 'ekmekler' WHERE `category` = 'bread';--> statement-breakpoint
UPDATE `posts` SET `category` = 'pogaca-acma-corek' WHERE `category` = 'pastry';
