// Relative imports only: drizzle-kit loads this file outside the Next.js resolver.
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { TranslationReport } from '../validators/admin/translation';
import { CURRENCIES, LOCALES, type Ingredients, type Instructions, type Utm } from '../validators/content';

const PROVIDERS = ['lemonsqueezy', 'paddle'] as const;

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date());

/* ───────────── Content ───────────── */

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
    category: text('category').notNull(),
    heroImageKey: text('hero_image_key'),
    isRecipe: integer('is_recipe', { mode: 'boolean' }).notNull().default(true),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    restMinutes: integer('rest_minutes'),
    baseServings: integer('base_servings'),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'advanced'] }),
    featuredProductId: text('featured_product_id').references(() => products.id, { onDelete: 'set null' }),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('posts_status_published_idx').on(t.status, t.publishedAt),
    index('posts_category_idx').on(t.category),
  ],
);

export const postTranslations = sqliteTable(
  'post_translations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    locale: text('locale', { enum: LOCALES }).notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    dek: text('dek'),
    bodyMd: text('body_md').notNull().default(''),
    heroImageAlt: text('hero_image_alt'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    ingredientsJson: text('ingredients_json', { mode: 'json' }).$type<Ingredients>(),
    instructionsJson: text('instructions_json', { mode: 'json' }).$type<Instructions>(),
    keywordsJson: text('keywords_json', { mode: 'json' }).$type<string[]>(),
    cuisine: text('cuisine'),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
    /** AI auto-translation metadata (admin.md §2): hashes drive "hand-edited" / "out of date". */
    aiSourceHash: text('ai_source_hash'),
    aiContentHash: text('ai_content_hash'),
    aiReportJson: text('ai_report_json', { mode: 'json' }).$type<TranslationReport>(),
    aiTranslatedAt: integer('ai_translated_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('post_translations_post_locale_uq').on(t.postId, t.locale),
    uniqueIndex('post_translations_locale_slug_uq').on(t.locale, t.slug),
    index('post_translations_locale_pub_idx').on(t.locale, t.isPublished),
  ],
);

/* ───────────── Commerce ───────────── */

export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['ebook'] }).notNull().default('ebook'),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
  coverImageKey: text('cover_image_key'),
  pageCount: integer('page_count'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const productTranslations = sqliteTable(
  'product_translations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    locale: text('locale', { enum: LOCALES }).notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    descriptionMd: text('description_md').notNull().default(''),
    coverAlt: text('cover_alt'),
  },
  (t) => [uniqueIndex('product_translations_product_locale_uq').on(t.productId, t.locale)],
);

export const productVariants = sqliteTable(
  'product_variants',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    contentLocale: text('content_locale', { enum: LOCALES }).notNull(),
    sku: text('sku').notNull().unique(),
    priceTry: integer('price_try').notNull(),
    priceUsd: integer('price_usd').notNull(),
    priceSar: integer('price_sar').notNull(),
    lsVariantId: text('ls_variant_id'),
    paddlePriceId: text('paddle_price_id'),
    pdfR2Key: text('pdf_r2_key'),
    pdfSizeBytes: integer('pdf_size_bytes'),
    pdfSha256: text('pdf_sha256'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('product_variants_product_locale_uq').on(t.productId, t.contentLocale),
    uniqueIndex('product_variants_ls_uq').on(t.lsVariantId),
    uniqueIndex('product_variants_paddle_uq').on(t.paddlePriceId),
  ],
);

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    provider: text('provider', { enum: PROVIDERS }).notNull(),
    providerOrderId: text('provider_order_id'),
    providerCustomerId: text('provider_customer_id'),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    email: text('email'),
    customerLocale: text('customer_locale', { enum: LOCALES }).notNull(),
    currency: text('currency', { enum: CURRENCIES }),
    amountSubtotal: integer('amount_subtotal'),
    amountTax: integer('amount_tax'),
    amountTotal: integer('amount_total'),
    status: text('status', { enum: ['pending', 'paid', 'refunded', 'failed'] }).notNull().default('pending'),
    lastEventName: text('last_event_name'),
    lastEventAt: integer('last_event_at', { mode: 'timestamp' }),
    downloadCount: integer('download_count').notNull().default(0),
    maxDownloads: integer('max_downloads').notNull().default(10),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    refundedAt: integer('refunded_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_provider_order_uq').on(t.provider, t.providerOrderId),
    index('orders_status_paid_idx').on(t.status, t.paidAt),
    index('orders_email_idx').on(t.email),
  ],
);

export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider', { enum: PROVIDERS }).notNull(),
    eventId: text('event_id').notNull(),
    eventName: text('event_name').notNull(),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    outcome: text('outcome', { enum: ['processed', 'ignored', 'failed'] }).notNull(),
    error: text('error'),
    receivedAt: integer('received_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_uq').on(t.provider, t.eventId)],
);

/* ───────────── Audience ───────────── */

export const subscribers = sqliteTable(
  'subscribers',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    locale: text('locale', { enum: LOCALES }).notNull(),
    source: text('source', { enum: ['footer', 'recipe_card', 'ebook_callout', 'popup', 'checkout'] }).notNull(),
    status: text('status', { enum: ['pending', 'active', 'unsubscribed', 'bounced'] }).notNull().default('pending'),
    confirmTokenHash: text('confirm_token_hash'),
    unsubscribeTokenHash: text('unsubscribe_token_hash'),
    referrerPath: text('referrer_path'),
    utmJson: text('utm_json', { mode: 'json' }).$type<Utm>(),
    consentAt: integer('consent_at', { mode: 'timestamp' }).notNull(),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
    unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('subscribers_status_locale_idx').on(t.status, t.locale),
    index('subscribers_source_idx').on(t.source),
  ],
);

/* ───────────── Admin ───────────── */

export const adminAuditLog = sqliteTable(
  'admin_audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorEmail: text('actor_email').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    diffJson: text('diff_json', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('admin_audit_entity_idx').on(t.entityType, t.entityId)],
);
