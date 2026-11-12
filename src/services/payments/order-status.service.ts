// Buyer-facing order status for /{locale}/checkout/success (polled), bound to the `nm_ord` cookie.
import type { OrderSummary, OrderSummaryRepo } from '@/repositories/order-summary';
import { formatPrice, priceFor } from '@/services/catalog/catalog.service';
import type { Locale } from '@/validators/content';
import { readOrderCookie } from './delivery.service';

export interface OrderStatusDeps {
  summaries: OrderSummaryRepo;
  secret: string;
  now: () => Date;
}

export type OrderState = 'pending' | 'paid' | 'refunded' | 'failed';

export type OrderStatusView =
  | { state: 'no_order' }
  | {
      state: OrderState;
      orderRef: string;
      productTitle: string;
      productSlug: string;
      edition: Locale;
      /** Charged total when the MoR reported it, otherwise the list price for the reader's locale. */
      total: string;
      downloadsLeft: number;
    };

export function productTitle(summary: Pick<OrderSummary, 'product'>, locale: Locale): string {
  const t = summary.product.titles;
  return (t.find((x) => x.locale === locale) ?? t.find((x) => x.locale === 'tr') ?? t[0])?.title ?? summary.product.slug;
}

export function toStatusView(summary: OrderSummary, locale: Locale): Exclude<OrderStatusView, { state: 'no_order' }> {
  const total =
    summary.currency && summary.amountTotal !== null
      ? formatPrice(summary.amountTotal, summary.currency, locale)
      : priceFor({ ...summary.variant, productId: '', sku: '', isActive: true }, locale).formatted;
  return {
    state: summary.status,
    orderRef: summary.id,
    productTitle: productTitle(summary, locale),
    productSlug: summary.product.slug,
    edition: summary.variant.contentLocale,
    total,
    downloadsLeft: Math.max(0, summary.maxDownloads - summary.downloadCount),
  };
}

export async function getOrderStatus(deps: OrderStatusDeps, cookie: string | undefined, locale: Locale): Promise<OrderStatusView> {
  const orderId = cookie ? await readOrderCookie(deps.secret, cookie, deps.now()) : null;
  if (!orderId) return { state: 'no_order' };
  const summary = await deps.summaries.find(orderId);
  return summary ? toStatusView(summary, locale) : { state: 'no_order' };
}
