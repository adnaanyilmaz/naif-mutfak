import type { OrdersRepo } from '@/repositories/orders';
import type { ProductsRepo } from '@/repositories/products';
import type { Locale } from '@/validators/content';
import { mintOrderCookie } from './delivery.service';
import { ProviderNotConfiguredError, type CheckoutParams, type PaymentProvider } from './provider';

export interface CheckoutDeps {
  orders: OrdersRepo;
  products: ProductsRepo;
  provider: PaymentProvider;
  secret: string;
  siteUrl: string;
  now: () => Date;
  newId: () => string;
  /** CHECKOUT_LIMITER keyed on a hashed client IP (payments.md §1). */
  limiter?: { allow(key: string): Promise<boolean> };
}

export type CheckoutResult =
  | { ok: true; params: CheckoutParams; orderCookie: string }
  | { ok: false; status: 404 | 409 | 429 | 503; error: 'variant_unavailable' | 'provider_unavailable' | 'provider_not_configured' | 'rate_limited' };

/** Creates the pending order (order_ref) and returns overlay params. Price/currency/email never come from the client. */
export async function startCheckout(
  deps: CheckoutDeps,
  input: { variantId: string; locale: Locale },
  opts: { clientKey?: string } = {},
): Promise<CheckoutResult> {
  if (deps.limiter && opts.clientKey && !(await deps.limiter.allow(opts.clientKey))) {
    return { ok: false, status: 429, error: 'rate_limited' };
  }
  const variant = await deps.products.findVariantForCheckout(input.variantId);
  if (!variant || !variant.isActive || variant.productStatus !== 'active') {
    return { ok: false, status: 404, error: 'variant_unavailable' };
  }
  const providerVariantId = deps.provider.id === 'lemonsqueezy' ? variant.lsVariantId : variant.paddlePriceId;
  if (!providerVariantId) return { ok: false, status: 409, error: 'provider_unavailable' };

  const orderRef = deps.newId();
  const successUrl = `${deps.siteUrl.replace(/\/+$/, '')}/${input.locale}/checkout/success`;
  let params: CheckoutParams;
  try {
    params = await deps.provider.createCheckout({ orderRef, providerVariantId, locale: input.locale, successUrl });
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) return { ok: false, status: 503, error: 'provider_not_configured' };
    throw err;
  }
  await deps.orders.createPending({ id: orderRef, provider: deps.provider.id, variantId: variant.id, customerLocale: input.locale });
  return { ok: true, params, orderCookie: await mintOrderCookie(deps.secret, orderRef, deps.now()) };
}
