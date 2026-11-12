// Local development only: a stand-in for the Lemon Squeezy overlay when no LS API key is configured.
// Completing a test payment builds a real LS `order_created` payload, signs it with the configured
// webhook secret and runs it through the production webhook pipeline (verify → Zod → atomic batch).
import { hmacSignHex } from '@/lib/cloudflare/crypto';
import type { OrderSummaryRepo } from '@/repositories/order-summary';
import { priceFor } from '@/services/catalog/catalog.service';
import { getCurrency } from '@/i18n/config';
import type { Locale } from '@/validators/content';
import { readOrderCookie } from './delivery.service';
import { productTitle } from './order-status.service';
import type { PaymentProvider } from './provider';
import { handleWebhook, type WebhookDeps } from './webhook.service';

/** Same provider, but checkout opens the local test screen instead of the MoR overlay. */
export function withTestCheckout(base: PaymentProvider): PaymentProvider {
  return {
    id: base.id,
    verifyWebhook: (raw, headers, now) => base.verifyWebhook(raw, headers, now),
    parseEvent: (raw) => base.parseEvent(raw),
    async createCheckout(req) {
      return { provider: 'test', url: `/${req.locale}/checkout/test?ref=${encodeURIComponent(req.orderRef)}` };
    },
  };
}

export interface TestCheckoutDeps {
  summaries: OrderSummaryRepo;
  /** DOWNLOAD_SIGNING_SECRET (reads the `nm_ord` cookie). */
  secret: string;
  /** LEMONSQUEEZY_WEBHOOK_SECRET (signs the simulated webhook). */
  webhookSecret: string;
  provider: PaymentProvider;
  webhook: WebhookDeps;
  now: () => Date;
}

export interface TestCheckoutView {
  orderRef: string;
  productTitle: string;
  productSlug: string;
  edition: Locale;
  price: string;
}

/** Only the browser that started this checkout (matching `nm_ord`) can see or complete it. */
async function ownedPendingOrder(deps: Pick<TestCheckoutDeps, 'summaries' | 'secret' | 'now'>, cookie: string | undefined, orderRef: string) {
  const owned = cookie ? await readOrderCookie(deps.secret, cookie, deps.now()) : null;
  if (!owned || owned !== orderRef) return null;
  const summary = await deps.summaries.find(orderRef);
  return summary && summary.status === 'pending' ? summary : null;
}

export async function getTestCheckout(
  deps: Pick<TestCheckoutDeps, 'summaries' | 'secret' | 'now'>,
  cookie: string | undefined,
  orderRef: string,
  locale: Locale,
): Promise<TestCheckoutView | null> {
  const summary = await ownedPendingOrder(deps, cookie, orderRef);
  if (!summary) return null;
  return {
    orderRef,
    productTitle: productTitle(summary, locale),
    productSlug: summary.product.slug,
    edition: summary.variant.contentLocale,
    price: priceFor({ ...summary.variant, productId: '', sku: '', isActive: true }, locale).formatted,
  };
}

export type TestCheckoutResult = { ok: true } | { ok: false; error: 'not_found' | 'not_configured' | 'rejected' };

export async function completeTestCheckout(
  deps: TestCheckoutDeps,
  cookie: string | undefined,
  input: { orderRef: string; locale: Locale },
): Promise<TestCheckoutResult> {
  if (deps.provider.id !== 'lemonsqueezy') return { ok: false, error: 'not_configured' };
  const summary = await ownedPendingOrder(deps, cookie, input.orderRef);
  if (!summary) return { ok: false, error: 'not_found' };
  if (!summary.variant.lsVariantId) return { ok: false, error: 'not_configured' };

  const now = deps.now();
  const currency = getCurrency(input.locale);
  const total = priceFor({ ...summary.variant, productId: '', sku: '', isActive: true }, input.locale).amountMinor;
  const raw = JSON.stringify({
    meta: { event_name: 'order_created', test_mode: true, custom_data: { order_ref: input.orderRef } },
    data: {
      type: 'orders',
      id: String(now.getTime()),
      attributes: {
        customer_id: 1,
        user_email: `test+${input.orderRef.slice(0, 8)}@naifmutfak.test`,
        currency,
        status: 'paid',
        subtotal: total,
        tax: 0,
        total,
        subtotal_usd: summary.variant.priceUsd,
        tax_usd: 0,
        total_usd: summary.variant.priceUsd,
        first_order_item: { variant_id: Number(summary.variant.lsVariantId) },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        refunded_at: null,
      },
    },
  });
  const headers = new Headers({ 'x-signature': await hmacSignHex(deps.webhookSecret, raw), 'x-event-name': 'order_created' });
  const result = await handleWebhook({ provider: deps.provider, raw, headers, deps: deps.webhook });
  return result.status === 200 ? { ok: true } : { ok: false, error: 'rejected' };
}
