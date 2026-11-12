// Integration: real D1 (Miniflare/workerd, in-memory). Verifies the optimistic-concurrency guard rolls back
// the whole batch, slug uniqueness mapping, upload swaps keeping the token, audit rows, and analytics SQL.
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/d1';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import * as schema from '@/db/schema';
import { createAdminPostsRepo, type AdminPostsRepo, type SavePostWrite } from './admin-posts';
import { createAnalyticsRepo } from './analytics.repo';

const POST_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const POST_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUCT = '11111111-1111-4111-8111-111111111111';
const VARIANT = '22222222-2222-4222-8222-222222222222';
const T0 = new Date('2026-11-01T00:00:00Z');
const audit = { actorEmail: 'chef@naifmutfak.com', action: 'post.save', entityType: 'post' as const, entityId: POST_A, diff: null };

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let db: D1Database;
let repo: AdminPostsRepo;

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  db = proxy.env.DB;
  const sql = readFileSync(new URL('../../migrations/0000_init.sql', import.meta.url), 'utf8');
  await db.batch(sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  const t0 = T0.getTime() / 1000;
  await db.batch([
    db.prepare("INSERT INTO posts (id, category, status, updated_at) VALUES (?, 'bread', 'draft', ?), (?, 'bread', 'draft', ?)").bind(POST_A, t0, POST_B, t0),
    db.prepare("INSERT INTO post_translations (post_id, locale, slug, title) VALUES (?, 'en', 'taken-slug', 'B')").bind(POST_B),
    db.prepare("INSERT INTO products (id, slug, status) VALUES (?, 'p', 'active')").bind(PRODUCT),
    db
      .prepare("INSERT INTO product_variants (id, product_id, content_locale, sku, price_try, price_usd, price_sar, is_active) VALUES (?, ?, 'en', 'SKU-EN', 1, 1, 1, 1)")
      .bind(VARIANT, PRODUCT),
  ]);
  repo = createAdminPostsRepo(drizzle(db, { schema }));
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

const write = (expected: Date, next: Date, slug: string, title: string): SavePostWrite => ({
  postId: POST_A,
  expectedUpdatedAt: expected,
  nextUpdatedAt: next,
  publishAt: next,
  post: {
    status: 'published',
    category: 'bread',
    isRecipe: false,
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    baseServings: null,
    difficulty: null,
    featuredProductId: null,
  },
  translations: [
    {
      locale: 'en',
      slug,
      title,
      dek: 'd',
      bodyMd: 'b',
      heroImageAlt: null,
      seoTitle: null,
      seoDescription: null,
      ingredients: null,
      instructions: null,
      keywords: ['k'],
      cuisine: null,
      isPublished: true,
    },
  ],
  audit,
});

const count = async (table: string) => (await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? 0;

describe('AdminPostsRepo on D1', () => {
  const T1 = new Date(T0.getTime() + 1000);

  it('saves when the token matches (post + translation + audit in one batch)', async () => {
    expect(await repo.save(write(T0, T1, 'first', 'First'))).toBe('saved');
    const post = await repo.find(POST_A);
    expect(post).toMatchObject({ status: 'published', updatedAt: T1, publishedAt: T1 });
    expect(post?.translations[0]).toMatchObject({ slug: 'first', keywords: ['k'], isPublished: true });
    expect(await count('admin_audit_log')).toBe(1);
  });

  it('returns conflict for a stale token and changes nothing', async () => {
    expect(await repo.save(write(T0, new Date(T0.getTime() + 5000), 'stale', 'Stale'))).toBe('conflict');
    const post = await repo.find(POST_A);
    expect(post?.translations[0]?.slug).toBe('first');
    expect(post?.updatedAt).toEqual(T1);
    expect(await count('admin_audit_log')).toBe(1);
  });

  it('maps (locale, slug) collisions to slug_taken and rolls back', async () => {
    expect(await repo.save(write(T1, new Date(T1.getTime() + 1000), 'taken-slug', 'Dup'))).toBe('slug_taken');
    expect((await repo.find(POST_A))?.updatedAt).toEqual(T1);
    expect(await repo.isSlugTaken('en', 'taken-slug', POST_A)).toBe(true);
    expect(await repo.isSlugTaken('en', 'first', POST_A)).toBe(false);
  });

  it('keeps published_at from the first publish', async () => {
    const T2 = new Date(T1.getTime() + 60_000);
    expect(await repo.save(write(T1, T2, 'first', 'Again'))).toBe('saved');
    expect((await repo.find(POST_A))?.publishedAt).toEqual(T1);
  });

  it('hero image swaps keep updated_at (the editor token) and return the previous key', async () => {
    const before = (await repo.find(POST_A))?.updatedAt;
    expect(await repo.setHeroImage(POST_A, 'posts/a/1.png', { ...audit, action: 'upload.post_hero' })).toEqual({ previousKey: null });
    expect(await repo.setHeroImage(POST_A, 'posts/a/2.png', { ...audit, action: 'upload.post_hero' })).toEqual({ previousKey: 'posts/a/1.png' });
    expect((await repo.find(POST_A))?.updatedAt).toEqual(before);
  });
});

describe('AnalyticsRepo on D1', () => {
  it('aggregates paid revenue per currency and period, never across currencies', async () => {
    const day = (d: string) => new Date(`${d}T12:00:00Z`).getTime() / 1000;
    const ins = db.prepare(
      'INSERT INTO orders (id, provider, variant_id, customer_locale, currency, amount_total, status, paid_at, refunded_at, created_at, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    await db.batch([
      ins.bind('o1', 'lemonsqueezy', VARIANT, 'en', 'USD', 1200, 'paid', day('2026-11-10'), null, day('2026-11-10'), 'a@example.com'),
      ins.bind('o2', 'lemonsqueezy', VARIANT, 'tr', 'TRY', 34900, 'paid', day('2026-11-10'), null, day('2026-11-10'), 'b@example.com'),
      ins.bind('o3', 'paddle', VARIANT, 'en', 'USD', 1200, 'paid', day('2026-11-11'), null, day('2026-11-11'), 'c@example.com'),
      ins.bind('o4', 'paddle', VARIANT, 'en', 'USD', 1200, 'refunded', day('2026-11-09'), day('2026-11-11'), day('2026-11-09'), null),
      ins.bind('o5', 'paddle', VARIANT, 'ar', null, null, 'pending', null, null, day('2026-11-11'), null),
    ]);
    const analytics = createAnalyticsRepo(drizzle(db, { schema }));
    const range = { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-13T00:00:00Z') };

    expect(await analytics.grossByCurrency(range)).toEqual(
      expect.arrayContaining([
        { currency: 'USD', orders: 2, gross: 2400 },
        { currency: 'TRY', orders: 1, gross: 34900 },
      ]),
    );
    expect(await analytics.refundsByCurrency(range)).toEqual([{ currency: 'USD', refunds: 1, amount: 1200 }]);
    expect(await analytics.revenueSeries(range, 'day')).toEqual([
      { period: '2026-11-10', currency: 'TRY', gross: 34900, orders: 1 },
      { period: '2026-11-10', currency: 'USD', gross: 1200, orders: 1 },
      { period: '2026-11-11', currency: 'USD', gross: 1200, orders: 1 },
    ]);
    expect(await analytics.byEdition(range)).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'p', contentLocale: 'en', currency: 'USD', orders: 2 })]));
    expect(await analytics.conversionCounts(range, new Date('2026-11-12T00:00:00Z'))).toEqual({ paid: 4, stalePending: 1, failed: 0 });

    const filters = { range, status: null, provider: null, currency: null, productId: null };
    const page1 = await analytics.ordersPage(filters, null, 2);
    const last = page1[1];
    if (!last) throw new Error('expected 2 rows');
    const page2 = await analytics.ordersPage(filters, { createdAt: last.createdAt.getTime() / 1000, id: last.id }, 10);
    expect([...page1, ...page2].map((o) => o.id)).toEqual(['o5', 'o3', 'o2', 'o1', 'o4']);
  });
});
