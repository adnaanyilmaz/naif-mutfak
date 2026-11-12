import { hmacVerifyHex } from '@/lib/cloudflare/crypto';
import { currencySchema } from '@/validators/content';
import {
  paddleAdjustmentSchema,
  paddleCustomerResponseSchema,
  paddleEnvelopeSchema,
  paddleTransactionSchema,
} from '@/validators/webhooks/paddle';
import {
  parseJson,
  ProviderNotConfiguredError,
  WebhookPayloadError,
  type OrderEvent,
  type PaymentProvider,
} from './provider';

export const PADDLE_SIGNATURE_TOLERANCE_SECONDS = 300;

export interface PaddleConfig {
  webhookSecret: string;
  apiKey?: string | undefined;
  clientToken?: string | undefined;
  environment: 'sandbox' | 'production';
  fetch?: typeof fetch;
}

/** `Paddle-Signature: ts=1671552777;h1=abc…[;h1=…]` → timestamp + candidate signatures. */
export function parsePaddleSignature(header: string): { ts: number; h1: string[] } | null {
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(';')) {
    const [k, v] = part.split('=', 2).map((s) => s.trim());
    if (!k || !v) continue;
    if (k === 'ts' && /^\d+$/.test(v)) ts = Number(v);
    if (k === 'h1') h1.push(v);
  }
  return ts !== null && h1.length > 0 ? { ts, h1 } : null;
}

export function createPaddleProvider(cfg: PaddleConfig): PaymentProvider {
  const doFetch = cfg.fetch ?? fetch;
  const apiBase = cfg.environment === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';

  async function fetchCustomerEmail(customerId: string): Promise<string> {
    if (!cfg.apiKey) throw new ProviderNotConfiguredError('PADDLE_API_KEY');
    const res = await doFetch(`${apiBase}/customers/${encodeURIComponent(customerId)}`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) throw new Error(`paddle_customer_fetch_failed_${res.status}`); // transient → 500 → retried
    return paddleCustomerResponseSchema.parse(await res.json()).data.email;
  }

  return {
    id: 'paddle',

    async verifyWebhook(raw, headers, now) {
      const header = headers.get('paddle-signature');
      const sig = header ? parsePaddleSignature(header) : null;
      if (!sig) return false;
      if (Math.abs(now.getTime() / 1000 - sig.ts) > PADDLE_SIGNATURE_TOLERANCE_SECONDS) return false;
      for (const h of sig.h1) {
        if (await hmacVerifyHex(cfg.webhookSecret, `${sig.ts}:${raw}`, h)) return true;
      }
      return false;
    },

    async parseEvent(raw): Promise<OrderEvent> {
      const json = parseJson(raw);
      const envelope = paddleEnvelopeSchema.safeParse(json);
      if (!envelope.success) throw new WebhookPayloadError('invalid_envelope');
      const { event_id: eventId, event_type: eventName } = envelope.data;

      if (eventName === 'transaction.completed') {
        const parsed = paddleTransactionSchema.safeParse(json);
        if (!parsed.success) throw new WebhookPayloadError('invalid_transaction_payload');
        const d = parsed.data.data;
        const [firstItem] = d.items;
        if (!firstItem) throw new WebhookPayloadError('no_items');
        const currency = currencySchema.safeParse(d.currency_code.toUpperCase());
        return {
          kind: 'paid',
          eventId,
          eventName,
          orderRef: d.custom_data?.order_ref ?? null,
          providerOrderId: d.id,
          providerCustomerId: d.customer_id,
          providerVariantId: firstItem.price.id,
          email: await fetchCustomerEmail(d.customer_id),
          money: currency.success ? { currency: currency.data, ...d.details.totals } : null,
          occurredAt: new Date(parsed.data.occurred_at),
        };
      }

      if (eventName === 'adjustment.created' || eventName === 'adjustment.updated') {
        const parsed = paddleAdjustmentSchema.safeParse(json);
        if (!parsed.success) throw new WebhookPayloadError('invalid_adjustment_payload');
        const d = parsed.data.data;
        if (d.action !== 'refund' || d.status !== 'approved') return { kind: 'ignored', eventId, eventName };
        return {
          kind: 'refunded',
          eventId,
          eventName,
          providerOrderId: d.transaction_id,
          providerVariantId: null,
          occurredAt: new Date(parsed.data.occurred_at),
        };
      }

      return { kind: 'ignored', eventId, eventName };
    },

    async createCheckout(req) {
      if (!cfg.clientToken) throw new ProviderNotConfiguredError('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN');
      return {
        provider: 'paddle',
        priceId: req.providerVariantId,
        clientToken: cfg.clientToken,
        environment: cfg.environment,
        customData: { order_ref: req.orderRef },
        locale: req.locale,
      };
    },
  };
}
