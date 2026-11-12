import type { PaymentProviderId } from '@/repositories/products';
import type { Currency, Locale } from '@/validators/content';

export type { PaymentProviderId };

export interface Money {
  currency: Currency;
  subtotal: number;
  tax: number;
  total: number;
}

export type OrderEvent =
  | {
      kind: 'paid';
      eventId: string;
      eventName: string;
      orderRef: string | null;
      providerOrderId: string;
      providerCustomerId: string;
      providerVariantId: string;
      email: string;
      /** null when the MoR reports a currency outside TRY/USD/SAR (logged for review). */
      money: Money | null;
      occurredAt: Date;
    }
  | {
      kind: 'refunded';
      eventId: string;
      eventName: string;
      providerOrderId: string;
      /** Present when the payload carries it (Lemon Squeezy); lets a refund-before-paid create the order. */
      providerVariantId: string | null;
      occurredAt: Date;
    }
  | { kind: 'ignored'; eventId: string; eventName: string };

/** Overlay parameters returned to the browser. Never contains secrets. */
export type CheckoutParams =
  | { provider: 'lemonsqueezy'; url: string }
  | {
      provider: 'paddle';
      priceId: string;
      clientToken: string;
      environment: 'sandbox' | 'production';
      customData: { order_ref: string };
      locale: Locale;
    };

export interface CheckoutRequest {
  orderRef: string;
  providerVariantId: string;
  locale: Locale;
  successUrl: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Signature check on the raw body. Must run before any parsing. */
  verifyWebhook(raw: string, headers: Headers, now: Date): Promise<boolean>;
  /** JSON.parse → Zod → normalized event. Throws WebhookPayloadError on schema failure. */
  parseEvent(raw: string): Promise<OrderEvent>;
  createCheckout(req: CheckoutRequest): Promise<CheckoutParams>;
}

export class WebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookPayloadError';
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(what: string) {
    super(`Payment provider not configured: ${what}`);
    this.name = 'ProviderNotConfiguredError';
  }
}

export function parseJson(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    throw new WebhookPayloadError('invalid_json');
  }
}
