import { describe, expect, it } from 'vitest';
import { hmacSignHex, sha256Hex } from '@/lib/cloudflare/crypto';
import { createFakeOrdersRepo, createFakeProductsRepo, fakeId, VARIANT_EN, VARIANT_TR, type StoredOrder } from '@/test/fakes';
import { createLemonSqueezyProvider } from './lemonsqueezy';
import { createPaddleProvider, parsePaddleSignature } from './paddle';
import { handleWebhook } from './webhook.service';

const LS_SECRET = 'ls-webhook-secret-0123456789';
const PADDLE_SECRET = 'pdl-webhook-secret-0123456789';
const NOW = new Date('2026-11-12T12:00:00Z');
const ORDER_REF = '6f1c2b8e-4d3a-4b2c-9e1f-0a1b2c3d4e5f';

function lsPayload(over: { event?: string; variant?: string; orderId?: string; currency?: string; ref?: string | null } = {}) {
  return JSON.stringify({
    meta: { event_name: over.event ?? 'order_created', custom_data: over.ref === null ? null : { order_ref: over.ref ?? ORDER_REF } },
    data: {
      type: 'orders',
      id: over.orderId ?? '9001',
      attributes: {
        customer_id: 77,
        user_email: '  Buyer@Example.com ',
        currency: over.currency ?? 'USD',
        status: over.event === 'order_refunded' ? 'refunded' : 'paid',
        subtotal: 1200,
        tax: 216,
        total: 1416,
        subtotal_usd: 1200,
        tax_usd: 216,
        total_usd: 1416,
        first_order_item: { variant_id: over.variant ?? 100002 },
        created_at: '2026-11-12T11:59:00.000000Z',
        updated_at: '2026-11-12T11:59:30.000000Z',
        refunded_at: over.event === 'order_refunded' ? '2026-11-12T11:59:50.000000Z' : null,
      },
    },
  });
}

async function lsHeaders(raw: string, secret = LS_SECRET) {
  return new Headers({ 'X-Signature': await hmacSignHex(secret, raw) });
}

function pendingOrder(over: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: ORDER_REF,
    provider: 'lemonsqueezy',
    providerOrderId: null,
    variantId: VARIANT_EN,
    customerLocale: 'en',
    status: 'pending',
    downloadCount: 0,
    maxDownloads: 10,
    ...over,
  };
}

function setup(initial: StoredOrder[] = []) {
  const fake = createFakeOrdersRepo(initial);
  const deps = { orders: fake.repo, products: createFakeProductsRepo(), now: () => NOW, newId: fakeId };
  const provider = createLemonSqueezyProvider({ webhookSecret: LS_SECRET });
  const send = async (raw: string, headers?: Headers) =>
    handleWebhook({ provider, raw, headers: headers ?? (await lsHeaders(raw)), deps });
  return { ...fake, send, deps };
}

describe('handleWebhook — Lemon Squeezy signature (crypto.subtle.verify)', () => {
  it('rejects a missing or invalid signature with 401 before parsing', async () => {
    const { send, events } = setup();
    const raw = lsPayload();
    expect((await send(raw, new Headers())).status).toBe(401);
    expect((await send(raw, await lsHeaders(raw, 'wrong-secret-0123456789'))).status).toBe(401);
    expect((await send(raw + ' ', await lsHeaders(raw))).status).toBe(401);
    expect((await send('not json', new Headers({ 'X-Signature': 'zz' }))).status).toBe(401);
    expect(events).toHaveLength(0);
  });

  it('returns 400 for a validly signed but malformed payload', async () => {
    const { send } = setup();
    const raw = JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: '1' } });
    expect((await send(raw)).status).toBe(400);
    expect((await send('{not json')).status).toBe(400);
  });
});

describe('handleWebhook — paid orders', () => {
  it('marks the pending order paid, records the event and adds the buyer as a pending subscriber', async () => {
    const { send, orders, events, subscribers } = setup([pendingOrder()]);
    const raw = lsPayload();
    const res = await send(raw);

    expect(res).toMatchObject({ status: 200, body: { ok: true, outcome: 'processed' } });
    expect(orders.get(ORDER_REF)).toMatchObject({
      status: 'paid',
      providerOrderId: '9001',
      email: 'buyer@example.com',
      currency: 'USD',
      amountTotal: 1416,
    });
    expect(events).toEqual([
      expect.objectContaining({ provider: 'lemonsqueezy', eventId: await sha256Hex(raw), outcome: 'processed', orderId: ORDER_REF }),
    ]);
    expect(subscribers).toEqual([expect.objectContaining({ email: 'buyer@example.com', source: 'checkout', locale: 'en' })]);
    expect(JSON.stringify(res.log)).not.toContain('example.com'); // no PII in logs
  });

  it('is idempotent: a redelivered event is a 200 duplicate with no side effects', async () => {
    const { send, events, subscribers } = setup([pendingOrder()]);
    const raw = lsPayload();
    await send(raw);
    const again = await send(raw);
    expect(again).toMatchObject({ status: 200, body: { ok: true, duplicate: true } });
    expect(events).toHaveLength(1);
    expect(subscribers).toHaveLength(1);
  });

  it('creates the order from provider data when order_ref is unknown or missing', async () => {
    const { send, orders } = setup();
    const res = await send(lsPayload({ ref: null }));
    expect(res.body.outcome).toBe('processed');
    const [created] = [...orders.values()];
    expect(created).toMatchObject({ status: 'paid', variantId: VARIANT_EN, providerOrderId: '9001' });
  });

  it('records the real payment but flags variant_mismatch for review', async () => {
    const { send, orders, events } = setup([pendingOrder({ variantId: VARIANT_TR })]);
    const res = await send(lsPayload({ variant: '100002' }));
    expect(res.body.outcome).toBe('failed');
    expect(orders.get(ORDER_REF)).toMatchObject({ status: 'paid', variantId: VARIANT_EN });
    expect(events[0]).toMatchObject({ outcome: 'failed', error: 'variant_mismatch' });
  });

  it('logs unknown variants as failed without touching orders', async () => {
    const { send, orders, events } = setup([pendingOrder()]);
    await send(lsPayload({ variant: '999999' }));
    expect(orders.get(ORDER_REF)?.status).toBe('pending');
    expect(events[0]).toMatchObject({ outcome: 'failed', error: 'unknown_variant' });
  });

  it('falls back to USD totals for unsupported display currencies', async () => {
    const { send, orders } = setup([pendingOrder()]);
    await send(lsPayload({ currency: 'EUR' }));
    expect(orders.get(ORDER_REF)).toMatchObject({ currency: 'USD', amountTotal: 1416 });
  });

  it('ignores events it does not handle (but records them)', async () => {
    const { send, events } = setup();
    const res = await send(JSON.stringify({ meta: { event_name: 'subscription_created' }, data: {} }));
    expect(res.body.outcome).toBe('ignored');
    expect(events[0]).toMatchObject({ outcome: 'ignored', eventName: 'subscription_created' });
  });
});

describe('handleWebhook — refunds & state machine', () => {
  it('refunds a paid order', async () => {
    const { send, orders } = setup([pendingOrder({ status: 'paid', providerOrderId: '9001' })]);
    const res = await send(lsPayload({ event: 'order_refunded' }));
    expect(res.body.outcome).toBe('processed');
    expect(orders.get(ORDER_REF)?.status).toBe('refunded');
  });

  it('handles refund-before-paid: creates a refunded row; the late paid event is a no-op', async () => {
    const { send, orders } = setup();
    await send(lsPayload({ event: 'order_refunded', ref: null }));
    const late = await send(lsPayload({ ref: null }));
    expect(late.body.outcome).toBe('ignored');
    const all = [...orders.values()];
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe('refunded');
  });

  it('never moves a refunded order back to paid via order_ref', async () => {
    const { send, orders } = setup([pendingOrder({ status: 'refunded', providerOrderId: '9001' })]);
    await send(lsPayload());
    expect(orders.get(ORDER_REF)?.status).toBe('refunded');
  });
});

describe('handleWebhook — Paddle', () => {
  const paddle = (fetchEmail = true) =>
    createPaddleProvider({
      webhookSecret: PADDLE_SECRET,
      apiKey: 'pdl_key',
      environment: 'sandbox',
      fetch: async () =>
        fetchEmail ? Response.json({ data: { email: 'p@example.com' } }) : new Response('nope', { status: 503 }),
    });

  const txn = JSON.stringify({
    event_id: 'evt_01',
    event_type: 'transaction.completed',
    occurred_at: '2026-11-12T11:59:00Z',
    data: {
      id: 'txn_01',
      customer_id: 'ctm_01',
      currency_code: 'TRY',
      custom_data: { order_ref: ORDER_REF },
      items: [{ price: { id: 'pri_en' } }],
      details: { totals: { subtotal: '34900', tax: '6282', total: '41182' } },
    },
  });

  async function paddleHeaders(raw: string, ts = Math.floor(NOW.getTime() / 1000)) {
    return new Headers({ 'Paddle-Signature': `ts=${ts};h1=${await hmacSignHex(PADDLE_SECRET, `${ts}:${raw}`)}` });
  }

  function run(raw: string, headers: Headers, provider = paddle(), initial = [pendingOrder({ provider: 'paddle' })]) {
    const fake = createFakeOrdersRepo(initial);
    const deps = { orders: fake.repo, products: createFakeProductsRepo(), now: () => NOW, newId: fakeId };
    return { fake, result: handleWebhook({ provider, raw, headers, deps }) };
  }

  it('verifies ts:body HMAC and records the transaction with string amounts coerced to ints', async () => {
    const { fake, result } = run(txn, await paddleHeaders(txn));
    expect((await result).status).toBe(200);
    expect(fake.orders.get(ORDER_REF)).toMatchObject({ status: 'paid', currency: 'TRY', amountTotal: 41182, email: 'p@example.com' });
  });

  it('rejects stale timestamps (> 5 min) and bad signatures', async () => {
    const stale = run(txn, await paddleHeaders(txn, Math.floor(NOW.getTime() / 1000) - 301));
    expect((await stale.result).status).toBe(401);
    const bad = run(txn, new Headers({ 'Paddle-Signature': `ts=${Math.floor(NOW.getTime() / 1000)};h1=${'0'.repeat(64)}` }));
    expect((await bad.result).status).toBe(401);
  });

  it('returns 500 (retry) when the customer lookup fails transiently', async () => {
    const { result } = run(txn, await paddleHeaders(txn), paddle(false));
    expect((await result).status).toBe(500);
  });

  it('parses multi-signature headers', () => {
    expect(parsePaddleSignature('ts=1;h1=aa;h1=bb')).toEqual({ ts: 1, h1: ['aa', 'bb'] });
    expect(parsePaddleSignature('h1=aa')).toBeNull();
  });
});
