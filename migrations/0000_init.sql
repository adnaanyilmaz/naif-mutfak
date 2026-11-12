CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`diff_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_entity_idx` ON `admin_audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_order_id` text,
	`provider_customer_id` text,
	`variant_id` text NOT NULL,
	`email` text,
	`customer_locale` text NOT NULL,
	`currency` text,
	`amount_subtotal` integer,
	`amount_tax` integer,
	`amount_total` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_event_name` text,
	`last_event_at` integer,
	`download_count` integer DEFAULT 0 NOT NULL,
	`max_downloads` integer DEFAULT 10 NOT NULL,
	`paid_at` integer,
	`refunded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_provider_order_uq` ON `orders` (`provider`,`provider_order_id`);--> statement-breakpoint
CREATE INDEX `orders_status_paid_idx` ON `orders` (`status`,`paid_at`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE TABLE `post_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` text NOT NULL,
	`locale` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`dek` text,
	`body_md` text DEFAULT '' NOT NULL,
	`hero_image_alt` text,
	`seo_title` text,
	`seo_description` text,
	`ingredients_json` text,
	`instructions_json` text,
	`keywords_json` text,
	`cuisine` text,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_translations_post_locale_uq` ON `post_translations` (`post_id`,`locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_translations_locale_slug_uq` ON `post_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE INDEX `post_translations_locale_pub_idx` ON `post_translations` (`locale`,`is_published`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`category` text NOT NULL,
	`hero_image_key` text,
	`is_recipe` integer DEFAULT true NOT NULL,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`rest_minutes` integer,
	`base_servings` integer,
	`difficulty` text,
	`featured_product_id` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`featured_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `posts_status_published_idx` ON `posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `posts_category_idx` ON `posts` (`category`);--> statement-breakpoint
CREATE TABLE `product_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description_md` text DEFAULT '' NOT NULL,
	`cover_alt` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_translations_product_locale_uq` ON `product_translations` (`product_id`,`locale`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`content_locale` text NOT NULL,
	`sku` text NOT NULL,
	`price_try` integer NOT NULL,
	`price_usd` integer NOT NULL,
	`price_sar` integer NOT NULL,
	`ls_variant_id` text,
	`paddle_price_id` text,
	`pdf_r2_key` text,
	`pdf_size_bytes` integer,
	`pdf_sha256` text,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_product_locale_uq` ON `product_variants` (`product_id`,`content_locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_ls_uq` ON `product_variants` (`ls_variant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_paddle_uq` ON `product_variants` (`paddle_price_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`type` text DEFAULT 'ebook' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`cover_image_key` text,
	`page_count` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirm_token_hash` text,
	`unsubscribe_token_hash` text,
	`referrer_path` text,
	`utm_json` text,
	`consent_at` integer NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `subscribers_status_locale_idx` ON `subscribers` (`status`,`locale`);--> statement-breakpoint
CREATE INDEX `subscribers_source_idx` ON `subscribers` (`source`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`event_name` text NOT NULL,
	`order_id` text,
	`outcome` text NOT NULL,
	`error` text,
	`received_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_provider_event_uq` ON `webhook_events` (`provider`,`event_id`);