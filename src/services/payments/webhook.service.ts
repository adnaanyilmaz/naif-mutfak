import { DEFAULT_LOCALE } from '@/i18n/config';
import { randomToken, sha256Hex } from '@/lib/cloudflare/crypto';
import type { ApplyWebhookInput, OrderMutation, OrderRecord, OrdersRepo, WebhookOutcome } from '@/repositories/orders';
import type { ProductsRepo } from '@/repositories/products';
import type { NewSubscriber } from '@/repositories/subscribers';
import { normalizeEmail } from '@/services/newsletter/subscribe.service';
import type { Locale } from '@/validators/content';
import { WebhookPayloadError, type OrderEvent, type PaymentProvider } from './provider';

export interface WebhookDeps {
  orders: OrdersRepo;
  products: ProductsRepo;
  now: () => Date;
  newId: () => string;
}

export interface WebhookResult {
  status: 200 | 400 | 401 | 500;
  body: { ok: boolean; duplicate?: boolean; outcome?: WebhookOutcome; error?: string };
  /** Safe-to-log identifiers only (no emails, no payloads). */
  log: { provider: string; eventId?: string; eventName?: string; orderId?: string | null; detail?: string };
}

type Plan = Omit<ApplyWebhookInput, 'event'> & { orderId: string | null; outcome: WebhookOutcome; error: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function buyerSubscriber(deps: WebhookDeps, email: string, locale: Locale, at: Date): Promise<NewSubscriber> {
  return {
    id: deps.newId(),
    email: normalizeEmail(email),
    locale,
    source: 'checkout',
    confirmTokenHash: await sha256Hex(randomToken()),
    unsubscribeTokenHash: await sha256Hex(randomToken()),
    referrerPath: null,
    utm: null,
    consentAt: at,
  };
}

async function findOrder(
  deps: WebhookDeps,
  provider: PaymentProvider['id'],
  orderRef: string | null,
  providerOrderId: string,
): Promise<OrderRecord | null> {
  // order_ref is client-influenced custom data: only trusted to locate a pending order of the same provider.
  if (orderRef && UUID.test(orderRef)) {
    const byRef = await deps.orders.findById(orderRef);
    if (byRef && byRef.provider === provider && (byRef.providerOrderId === null || byRef.providerOrderId === providerOrderId)) {
      return byRef;
    }
  }
  return deps.orders.findByProviderOrderId(provider, providerOrderId);
}

async function planPaid(deps: WebhookDeps, provider: PaymentProvider['id'], ev: Extract<OrderEvent, { kind: 'paid' }>): Promise<Plan> {
  const variantId = await deps.products.findVariantIdByProviderRef(provider, ev.providerVariantId);
  if (!variantId) return { order: null, subscriber: null, orderId: null, outcome: 'failed', error: 'unknown_variant' };

  const errors: string[] = [];
  if (!ev.money) errors.push('unsupported_currency');
  const existing = await findOrder(deps, provider, ev.orderRef, ev.providerOrderId);
  const values = {
    providerOrderId: ev.providerOrderId,
    providerCustomerId: ev.providerCustomerId,
    variantId,
    email: normalizeEmail(ev.email),
    eventName: ev.eventName,
    occurredAt: ev.occurredAt,
  };

  let order: OrderMutation | null;
  let orderId: string;
  let locale: Locale = DEFAULT_LOCALE;
  if (existing) {
    orderId = existing.id;
    locale = existing.customerLocale;
    if (existing.variantId !== variantId) errors.push('variant_mismatch'); // payment is real: record provider data
    order =
      existing.status === 'pending' || existing.status === 'failed'
        ? {
            kind: 'markPaid',
            orderId,
            values: {
              ...values,
              currency: ev.money?.currency ?? null,
              amountSubtotal: ev.money?.subtotal ?? null,
              amountTax: ev.money?.tax ?? null,
              amountTotal: ev.money?.total ?? null,
            },
          }
        : null; // already paid/refunded: monotonic, never move backwards
  } else {
    orderId = deps.newId();
    order = {
      kind: 'insert',
      values: {
        id: orderId,
        provider,
        customerLocale: locale,
        status: 'paid',
        ...values,
        lastEventName: ev.eventName,
        lastEventAt: ev.occurredAt,
        paidAt: ev.occurredAt,
        ...(ev.money
          ? { currency: ev.money.currency, amountSubtotal: ev.money.subtotal, amountTax: ev.money.tax, amountTotal: ev.money.total }
          : {}),
      },
    };
  }

  const subscriber = order ? await buyerSubscriber(deps, ev.email, locale, ev.occurredAt) : null;
  const outcome: WebhookOutcome = errors.length > 0 ? 'failed' : order ? 'processed' : 'ignored';
  return { order, subscriber, orderId, outcome, error: errors.length > 0 ? errors.join(',') : null };
}

async function planRefund(
  deps: WebhookDeps,
  provider: PaymentProvider['id'],
  ev: Extract<OrderEvent, { kind: 'refunded' }>,
): Promise<Plan | 'retry'> {
  const existing = await deps.orders.findByProviderOrderId(provider, ev.providerOrderId);
  if (existing) {
    const order: OrderMutation | null =
      existing.status === 'pending' || existing.status === 'paid'
        ? { kind: 'markRefunded', orderId: existing.id, eventName: ev.eventName, occurredAt: ev.occurredAt }
        : null;
    return { order, subscriber: null, orderId: existing.id, outcome: order ? 'processed' : 'ignored', error: null };
  }
  // Refund before paid: create the row as refunded when the variant is known; the later paid event becomes a no-op.
  const variantId = ev.providerVariantId
    ? await deps.products.findVariantIdByProviderRef(provider, ev.providerVariantId)
    : null;
  if (!variantId) return 'retry';
  const orderId = deps.newId();
  return {
    order: {
      kind: 'insert',
      values: {
        id: orderId,
        provider,
        customerLocale: DEFAULT_LOCALE,
        variantId,
        status: 'refunded',
        providerOrderId: ev.providerOrderId,
        lastEventName: ev.eventName,
        lastEventAt: ev.occurredAt,
        refundedAt: ev.occurredAt,
      },
    },
    subscriber: null,
    orderId,
    outcome: 'processed',
    error: null,
  };
}

/** verify (raw bytes) → parse (Zod) → plan → one atomic D1 batch keyed on (provider, event_id). */
export async function handleWebhook(args: {
  provider: PaymentProvider;
  raw: string;
  headers: Headers;
  deps: WebhookDeps;
}): Promise<WebhookResult> {
  const { provider, raw, headers, deps } = args;
  const log: WebhookResult['log'] = { provider: provider.id };

  if (!(await provider.verifyWebhook(raw, headers, deps.now()))) {
    return { status: 401, body: { ok: false, error: 'invalid_signature' }, log: { ...log, detail: 'invalid_signature' } };
  }

  try {
    const ev = await provider.parseEvent(raw);
    log.eventId = ev.eventId;
    log.eventName = ev.eventName;

    let plan: Plan;
    if (ev.kind === 'ignored') {
      plan = { order: null, subscriber: null, orderId: null, outcome: 'ignored', error: null };
    } else if (ev.kind === 'paid') {
      plan = await planPaid(deps, provider.id, ev);
    } else {
      const refund = await planRefund(deps, provider.id, ev);
      if (refund === 'retry') {
        return { status: 500, body: { ok: false, error: 'order_not_found_retry' }, log: { ...log, detail: 'refund_before_paid' } };
      }
      plan = refund;
    }
    log.orderId = plan.orderId;

    const applied = await deps.orders.applyWebhook({
      event: {
        provider: provider.id,
        eventId: ev.eventId,
        eventName: ev.eventName,
        orderId: plan.orderId,
        outcome: plan.outcome,
        error: plan.error,
      },
      order: plan.order,
      subscriber: plan.subscriber,
    });
    if (applied === 'duplicate') return { status: 200, body: { ok: true, duplicate: true }, log: { ...log, detail: 'duplicate' } };
    return { status: 200, body: { ok: true, outcome: plan.outcome }, log: { ...log, detail: plan.error ?? plan.outcome } };
  } catch (err) {
    if (err instanceof WebhookPayloadError) {
      return { status: 400, body: { ok: false, error: 'invalid_payload' }, log: { ...log, detail: err.message } };
    }
    return { status: 500, body: { ok: false, error: 'internal' }, log: { ...log, detail: err instanceof Error ? err.name : 'unknown' } };
  }
}
