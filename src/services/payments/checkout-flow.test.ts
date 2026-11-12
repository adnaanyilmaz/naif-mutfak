// Order status, local test checkout (through the real signed webhook pipeline), rate limits, payment settings.
import { describe, expect, it } from 'vitest';
import type { OrderSummary, OrderSummaryRepo } from '@/repositories/order-summary';
import { getPaymentSettings, PROVIDER_EVENTS } from '@/services/admin/payment-settings.service';
import { createFakeOrdersRepo, createFakeProductsRepo, fakeId, sampleVariants, VARIANT_EN, type StoredOrder } from '@/test/fakes';
import { startCheckout } from './checkout.service';
import { mintDownloadToken, mintOrderCookie, redeemDownloadToken } from './delivery.service';
import { createLemonSqueezyProvider } from './lemonsqueezy';
import { getOrderStatus, toStatusView } from './order-status.service';
import { completeTestCheckout, getTestCheckout, withTestCheckout } from './test-checkout.service';

const SECRET = 'd'.repeat(48);
const LS_SECRET = 'ls-webhook-secret-0123456789';
const NOW = new Date('2026-11-12T12:00:00Z');
const ORDER = '7c1e0a51-4c39-4a3e-9f1d-2c9e1a0b0c01';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture');
  return value;
}
const variantEn = required(sampleVariants.find((v) => v.id === VARIANT_EN));

function summary(over: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: ORDER,
    status: 'pending',
    currency: null,
    amountTotal: null,
    downloadCount: 2,
    maxDownloads: 10,
    variant: {
      id: variantEn.id,
      contentLocale: 'en',
      lsVariantId: variantEn.lsVariantId,
      paddlePriceId: variantEn.paddlePriceId,
      priceTry: variantEn.priceTry,
      priceUsd: variantEn.priceUsd,
      priceSar: variantEn.priceSar,
    },
    product: { slug: 'baking-at-home', titles: [{ locale: 'tr', title: 'Evde Fırın' }, { locale: 'en', title: 'Baking at Home' }] },
    ...over,
  };
}

/** Summary repo backed by the fake orders map, so webhook writes are visible to status reads. */
function summariesOver(orders: Map<string, StoredOrder>, base: OrderSummary): OrderSummaryRepo {
  return {
    async find(id) {
      const o = orders.get(id);
      if (!o) return null;
      const currency = o.currency === 'TRY' || o.currency === 'USD' || o.currency === 'SAR' ? o.currency : null;
      const amountTotal = typeof o.amountTotal === 'number' ? o.amountTotal : null;
      return { ...base, id, status: o.status, currency, amountTotal, downloadCount: o.downloadCount };
    },
  };
}

const pendingOrder = (): StoredOrder => ({
  id: ORDER,
  provider: 'lemonsqueezy',
  providerOrderId: null,
  variantId: VARIANT_EN,
  customerLocale: 'en',
  status: 'pending',
  downloadCount: 0,
  maxDownloads: 10,
});

describe('order status', () => {
  it('prefers the charged total and the reader-locale title', () => {
    expect(toStatusView(summary({ status: 'paid', currency: 'USD', amountTotal: 1416 }), 'en')).toMatchObject({
      state: 'paid',
      productTitle: 'Baking at Home',
      total: '$14.16',
      downloadsLeft: 8,
    });
    expect(toStatusView(summary(), 'ar')).toMatchObject({ productTitle: 'Evde Fırın', total: expect.stringContaining('٤٥') });
  });

  it('is bound to the checkout cookie', async () => {
    const deps = { summaries: { find: async () => summary() }, secret: SECRET, now: () => NOW };
    expect(await getOrderStatus(deps, undefined, 'en')).toEqual({ state: 'no_order' });
    expect(await getOrderStatus(deps, 'forged.cookie', 'en')).toEqual({ state: 'no_order' });
    const cookie = await mintOrderCookie(SECRET, ORDER, NOW);
    expect(await getOrderStatus(deps, cookie, 'en')).toMatchObject({ state: 'pending', orderRef: ORDER });
  });
});

describe('local test checkout', () => {
  async function setup() {
    const fake = createFakeOrdersRepo([pendingOrder()]);
    const provider = withTestCheckout(createLemonSqueezyProvider({ webhookSecret: LS_SECRET }));
    const deps = {
      summaries: summariesOver(fake.orders, summary()),
      secret: SECRET,
      webhookSecret: LS_SECRET,
      provider,
      webhook: { orders: fake.repo, products: createFakeProductsRepo(), now: () => NOW, newId: fakeId },
      now: () => NOW,
    };
    return { fake, deps, cookie: await mintOrderCookie(SECRET, ORDER, NOW) };
  }

  it('routes checkout to the local test screen instead of the MoR overlay', async () => {
    const provider = withTestCheckout(createLemonSqueezyProvider({ webhookSecret: LS_SECRET }));
    expect(await provider.createCheckout({ orderRef: ORDER, providerVariantId: '1', locale: 'ar', successUrl: 'x' })).toEqual({
      provider: 'test',
      url: `/ar/checkout/test?ref=${ORDER}`,
    });
  });

  it('marks the order paid via a signed LS webhook and records the event + buyer', async () => {
    const { fake, deps, cookie } = await setup();
    expect(await getTestCheckout(deps, cookie, ORDER, 'en')).toMatchObject({ productTitle: 'Baking at Home', price: '$12.00' });
    expect(await completeTestCheckout(deps, cookie, { orderRef: ORDER, locale: 'en' })).toEqual({ ok: true });
    expect(fake.orders.get(ORDER)).toMatchObject({ status: 'paid', currency: 'USD', amountTotal: 1200 });
    expect(fake.events).toHaveLength(1);
    expect(fake.subscribers[0]?.source).toBe('checkout');
    // Already paid → the test screen is gone and cannot be replayed.
    expect(await getTestCheckout(deps, cookie, ORDER, 'en')).toBeNull();
    expect(await completeTestCheckout(deps, cookie, { orderRef: ORDER, locale: 'en' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('refuses other browsers and other orders', async () => {
    const { deps } = await setup();
    const other = await mintOrderCookie(SECRET, fakeId(), NOW);
    expect(await completeTestCheckout(deps, other, { orderRef: ORDER, locale: 'en' })).toEqual({ ok: false, error: 'not_found' });
    expect(await completeTestCheckout(deps, undefined, { orderRef: ORDER, locale: 'en' })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('rate limits', () => {
  const deny = { allow: async () => false };

  it('rejects checkout with 429 before creating an order', async () => {
    const fake = createFakeOrdersRepo();
    const result = await startCheckout(
      {
        orders: fake.repo,
        products: createFakeProductsRepo(),
        provider: createLemonSqueezyProvider({ webhookSecret: LS_SECRET }),
        secret: SECRET,
        siteUrl: 'https://naifmutfak.com',
        now: () => NOW,
        newId: fakeId,
        limiter: deny,
      },
      { variantId: VARIANT_EN, locale: 'en' },
      { clientKey: 'k' },
    );
    expect(result).toEqual({ ok: false, status: 429, error: 'rate_limited' });
    expect(fake.orders.size).toBe(0);
  });

  it('rejects downloads with 429 without consuming a download', async () => {
    const fake = createFakeOrdersRepo([{ ...pendingOrder(), status: 'paid' }]);
    const token = await mintDownloadToken({ secret: SECRET, orderId: ORDER, variantId: VARIANT_EN, now: NOW });
    const result = await redeemDownloadToken(
      { orders: fake.repo, products: createFakeProductsRepo(), store: { get: async () => null }, secret: SECRET, now: () => NOW, limiter: deny },
      token,
    );
    expect(result).toEqual({ status: 429, error: 'rate_limited' });
    expect(fake.orders.get(ORDER)?.downloadCount).toBe(0);
  });
});

describe('payment settings', () => {
  it('reports missing secrets and editions without a provider id, never values', async () => {
    const view = await getPaymentSettings({
      provider: 'lemonsqueezy',
      environment: 'development',
      paddleEnv: 'sandbox',
      siteUrl: 'http://localhost:3000/',
      testCheckout: true,
      isConfigured: (name) => name === 'LEMONSQUEEZY_WEBHOOK_SECRET' || name === 'DOWNLOAD_SIGNING_SECRET',
      listProducts: async () => [
        {
          id: 'p1',
          slug: 'baking-at-home',
          status: 'active',
          coverImageKey: null,
          pageCount: 148,
          updatedAt: NOW,
          titles: [{ locale: 'tr', title: 'Evde Fırın' }],
          variants: [
            { contentLocale: 'tr', isActive: true, hasPdf: true, priceTry: 1, lsVariantId: '1', paddlePriceId: null },
            { contentLocale: 'ar', isActive: false, hasPdf: false, priceTry: 1, lsVariantId: null, paddlePriceId: 'pri_x' },
          ],
        },
      ],
      webhookOutcomes: async () => [{ outcome: 'processed', count: 3 }],
      now: () => NOW,
    });
    expect(view).toMatchObject({
      mode: 'test',
      ready: false,
      webhookUrl: 'http://localhost:3000/api/webhooks/payment',
      events: PROVIDER_EVENTS.lemonsqueezy,
      missingIds: [{ productId: 'p1', title: 'Evde Fırın', locale: 'ar' }],
    });
    expect(view.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['apiKey', 'storeId']);
    expect(JSON.stringify(view)).not.toContain('secret-value');
  });
});
