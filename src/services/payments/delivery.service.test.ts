import { describe, expect, it } from 'vitest';
import { signToken } from '@/lib/cloudflare/crypto';
import type { PrivateFileStore } from '@/lib/cloudflare/r2';
import { createFakeOrdersRepo, createFakeProductsRepo, VARIANT_EN, type StoredOrder } from '@/test/fakes';
import {
  issueDownloadToken,
  mintDownloadToken,
  mintOrderCookie,
  redeemDownloadToken,
  verifyDownloadToken,
} from './delivery.service';

const SECRET = 'download-signing-secret-0123456789abcdef';
const NOW = new Date('2026-11-12T12:00:00Z');
const ORDER = '6f1c2b8e-4d3a-4b2c-9e1f-0a1b2c3d4e5f';

const paid = (over: Partial<StoredOrder> = {}): StoredOrder => ({
  id: ORDER,
  provider: 'lemonsqueezy',
  providerOrderId: '9001',
  variantId: VARIANT_EN,
  customerLocale: 'en',
  status: 'paid',
  downloadCount: 0,
  maxDownloads: 10,
  ...over,
});

const store = (present = true): PrivateFileStore => ({
  async get() {
    return present ? { body: new Blob(['%PDF-1.4']).stream(), size: 8 } : null;
  },
});

function deps(orders: StoredOrder[], opts: { now?: Date; present?: boolean } = {}) {
  const fake = createFakeOrdersRepo(orders);
  return {
    fake,
    deps: {
      orders: fake.repo,
      products: createFakeProductsRepo(),
      store: store(opts.present ?? true),
      secret: SECRET,
      now: () => opts.now ?? NOW,
    },
  };
}

describe('verifyDownloadToken', () => {
  it('accepts a fresh dl token', async () => {
    const token = await mintDownloadToken({ secret: SECRET, orderId: ORDER, variantId: VARIANT_EN, now: NOW });
    expect(await verifyDownloadToken(SECRET, token, NOW)).toEqual({ valid: true, orderId: ORDER, variantId: VARIANT_EN });
  });

  it('expires after 15 minutes', async () => {
    const token = await mintDownloadToken({ secret: SECRET, orderId: ORDER, variantId: VARIANT_EN, now: NOW });
    const later = new Date(NOW.getTime() + 15 * 60 * 1000);
    expect(await verifyDownloadToken(SECRET, token, later)).toEqual({ valid: false, reason: 'expired' });
    expect((await verifyDownloadToken(SECRET, token, new Date(later.getTime() - 1000))).valid).toBe(true);
  });

  it('rejects tokens signed with another secret, tampered, or of another type', async () => {
    const foreign = await mintDownloadToken({ secret: 'x'.repeat(40), orderId: ORDER, variantId: VARIANT_EN, now: NOW });
    expect(await verifyDownloadToken(SECRET, foreign, NOW)).toEqual({ valid: false, reason: 'bad_signature' });

    const token = await mintDownloadToken({ secret: SECRET, orderId: ORDER, variantId: VARIANT_EN, now: NOW });
    expect((await verifyDownloadToken(SECRET, `a${token}`, NOW)).valid).toBe(false);

    const cookie = await mintOrderCookie(SECRET, ORDER, NOW); // an `ord` token must not work as `dl`
    expect(await verifyDownloadToken(SECRET, cookie, NOW)).toEqual({ valid: false, reason: 'wrong_type' });

    const bogus = await signToken(SECRET, { typ: 'dl', o: 'not-a-uuid', v: VARIANT_EN, exp: 9e9 });
    expect(await verifyDownloadToken(SECRET, bogus, NOW)).toEqual({ valid: false, reason: 'wrong_type' });

    expect(await verifyDownloadToken(SECRET, '', NOW)).toEqual({ valid: false, reason: 'malformed' });
  });
});

describe('redeemDownloadToken', () => {
  const tokenFor = () => mintDownloadToken({ secret: SECRET, orderId: ORDER, variantId: VARIANT_EN, now: NOW });

  it('streams the PDF for a paid order and counts the download', async () => {
    const { fake, deps: d } = deps([paid()]);
    const res = await redeemDownloadToken(d, await tokenFor());
    expect(res).toMatchObject({ status: 200, size: 8, filename: 'baking-at-home-en.pdf' });
    expect(fake.orders.get(ORDER)?.downloadCount).toBe(1);
  });

  it('denies refunded or unpaid orders (403) — refunds revoke immediately', async () => {
    for (const status of ['refunded', 'pending', 'failed'] as const) {
      const { deps: d } = deps([paid({ status })]);
      expect((await redeemDownloadToken(d, await tokenFor())).status).toBe(403);
    }
  });

  it('enforces max_downloads', async () => {
    const { deps: d } = deps([paid({ downloadCount: 10 })]);
    expect(await redeemDownloadToken(d, await tokenFor())).toEqual({ status: 403, error: 'not_entitled' });
  });

  it('returns 401 for expired tokens and 404 when the object is missing', async () => {
    const expired = deps([paid()], { now: new Date(NOW.getTime() + 60 * 60 * 1000) });
    expect((await redeemDownloadToken(expired.deps, await tokenFor())).status).toBe(401);
    const missing = deps([paid()], { present: false });
    expect((await redeemDownloadToken(missing.deps, await tokenFor())).status).toBe(404);
  });
});

describe('issueDownloadToken', () => {
  it('requires a valid order cookie and a paid order', async () => {
    const { deps: d } = deps([paid()]);
    expect(await issueDownloadToken(d, undefined)).toEqual({ status: 'unauthorized' });
    expect(await issueDownloadToken(d, 'garbage.token')).toEqual({ status: 'unauthorized' });

    const res = await issueDownloadToken(d, await mintOrderCookie(SECRET, ORDER, NOW));
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect((await verifyDownloadToken(SECRET, res.token, NOW)).valid).toBe(true);

    const pending = deps([paid({ status: 'pending' })]);
    expect(await issueDownloadToken(pending.deps, await mintOrderCookie(SECRET, ORDER, NOW))).toEqual({ status: 'not_paid' });
  });

  it('rejects an expired order cookie', async () => {
    const { deps: d } = deps([paid()], { now: new Date(NOW.getTime() + 25 * 60 * 60 * 1000) });
    expect(await issueDownloadToken(d, await mintOrderCookie(SECRET, ORDER, NOW))).toEqual({ status: 'unauthorized' });
  });
});
