// Integration: real D1 (Miniflare/workerd, in-memory) + generated migrations. Verifies the atomic
// webhook batch, UNIQUE(provider, event_id) idempotency, monotonic guards and the download counter.
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/d1';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import * as schema from '@/db/schema';
import { createOrdersRepo, type ApplyWebhookInput, type OrdersRepo } from './orders';

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const VARIANT = '22222222-2222-4222-8222-222222222222';
const ORDER = '33333333-3333-4333-8333-333333333333';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let repo: OrdersRepo;
let db: D1Database;

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  db = proxy.env.DB;
  const sql = readFileSync(new URL('../../migrations/0000_init.sql', import.meta.url), 'utf8');
  const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
  await db.batch(statements.map((s) => db.prepare(s)));
  await db.batch([
    db.prepare("INSERT INTO products (id, slug, status) VALUES (?, 'p', 'active')").bind(PRODUCT),
    db
      .prepare(
        "INSERT INTO product_variants (id, product_id, content_locale, sku, price_try, price_usd, price_sar, ls_variant_id, is_active) VALUES (?, ?, 'en', 'SKU', 1, 1, 1, '100002', 1)",
      )
      .bind(VARIANT, PRODUCT),
  ]);
  repo = createOrdersRepo(drizzle(db, { schema }));
  await repo.createPending({ id: ORDER, provider: 'lemonsqueezy', variantId: VARIANT, customerLocale: 'en' });
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

const paidInput = (eventId: string): ApplyWebhookInput => ({
  event: { provider: 'lemonsqueezy', eventId, eventName: 'order_created', orderId: ORDER, outcome: 'processed', error: null },
  order: {
    kind: 'markPaid',
    orderId: ORDER,
    values: {
      providerOrderId: '9001',
      providerCustomerId: '77',
      variantId: VARIANT,
      email: 'buyer@example.com',
      currency: 'USD',
      amountSubtotal: 1200,
      amountTax: 216,
      amountTotal: 1416,
      eventName: 'order_created',
      occurredAt: new Date('2026-11-12T12:00:00Z'),
    },
  },
  subscriber: {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'buyer@example.com',
    locale: 'en',
    source: 'checkout',
    confirmTokenHash: 'h1',
    unsubscribeTokenHash: 'h2',
    referrerPath: null,
    utm: null,
    consentAt: new Date('2026-11-12T12:00:00Z'),
  },
});

async function count(table: string): Promise<number> {
  const row = await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

describe('OrdersRepo on D1', () => {
  it('applies event + order + subscriber atomically', async () => {
    expect(await repo.applyWebhook(paidInput('evt-1'))).toBe('applied');
    expect(await repo.findById(ORDER)).toMatchObject({ status: 'paid', providerOrderId: '9001' });
    expect(await count('webhook_events')).toBe(1);
    expect(await count('subscribers')).toBe(1);
  });

  it('returns duplicate for a replayed event id and rolls back the whole batch', async () => {
    const replay = paidInput('evt-1');
    if (replay.order?.kind === 'markPaid') replay.order.values.amountTotal = 999_999;
    expect(await repo.applyWebhook(replay)).toBe('duplicate');
    const row = await db.prepare('SELECT amount_total FROM orders WHERE id = ?').bind(ORDER).first<{ amount_total: number }>();
    expect(row?.amount_total).toBe(1416);
    expect(await count('webhook_events')).toBe(1);
  });

  it('counts downloads atomically up to max_downloads, then denies', async () => {
    await db.prepare('UPDATE orders SET max_downloads = 2 WHERE id = ?').bind(ORDER).run();
    const results = await Promise.all([1, 2, 3].map(() => repo.consumeDownload(ORDER)));
    expect(results.filter((r) => r === VARIANT)).toHaveLength(2);
    expect(results.filter((r) => r === null)).toHaveLength(1);
  });

  it('refund revokes entitlement and is never reverted by a later paid event', async () => {
    await repo.applyWebhook({
      event: { provider: 'lemonsqueezy', eventId: 'evt-2', eventName: 'order_refunded', orderId: ORDER, outcome: 'processed', error: null },
      order: { kind: 'markRefunded', orderId: ORDER, eventName: 'order_refunded', occurredAt: new Date() },
      subscriber: null,
    });
    await db.prepare('UPDATE orders SET max_downloads = 10 WHERE id = ?').bind(ORDER).run();
    expect(await repo.consumeDownload(ORDER)).toBeNull();
    expect(await repo.applyWebhook(paidInput('evt-3'))).toBe('applied'); // guarded update: no-op
    expect((await repo.findById(ORDER))?.status).toBe('refunded');
  });
});
