import { hmacVerifyHex, sha256Hex } from '@/lib/cloudflare/crypto';
import { currencySchema } from '@/validators/content';
import { lsEnvelopeSchema, lsOrderWebhookSchema, type LsOrderWebhook } from '@/validators/webhooks/lemonsqueezy';
import { z } from 'zod';
import {
  parseJson,
  ProviderNotConfiguredError,
  WebhookPayloadError,
  type Money,
  type OrderEvent,
  type PaymentProvider,
} from './provider';

export interface LemonSqueezyConfig {
  webhookSecret: string;
  apiKey?: string | undefined;
  storeId?: string | undefined;
  fetch?: typeof fetch;
}

const checkoutResponseSchema = z.object({ data: z.object({ attributes: z.object({ url: z.url() }) }) });

/** LS amounts are integer cents. Unsupported display currencies fall back to the USD totals LS always reports. */
export function lsMoney(a: LsOrderWebhook['data']['attributes']): Money {
  const currency = currencySchema.safeParse(a.currency.toUpperCase());
  if (currency.success) return { currency: currency.data, subtotal: a.subtotal, tax: a.tax, total: a.total };
  return { currency: 'USD', subtotal: a.subtotal_usd, tax: a.tax_usd, total: a.total_usd };
}

export function createLemonSqueezyProvider(cfg: LemonSqueezyConfig): PaymentProvider {
  const doFetch = cfg.fetch ?? fetch;
  return {
    id: 'lemonsqueezy',

    async verifyWebhook(raw, headers) {
      const signature = headers.get('x-signature');
      if (!signature) return false;
      return hmacVerifyHex(cfg.webhookSecret, raw, signature);
    },

    async parseEvent(raw): Promise<OrderEvent> {
      const json = parseJson(raw);
      const envelope = lsEnvelopeSchema.safeParse(json);
      if (!envelope.success) throw new WebhookPayloadError('invalid_envelope');
      // LS sends no event id: the SHA-256 of the raw body identifies a delivery (retries are byte-identical).
      const eventId = await sha256Hex(raw);
      const eventName = envelope.data.meta.event_name;
      if (eventName !== 'order_created' && eventName !== 'order_refunded') {
        return { kind: 'ignored', eventId, eventName };
      }
      const parsed = lsOrderWebhookSchema.safeParse(json);
      if (!parsed.success) throw new WebhookPayloadError('invalid_order_payload');
      const { meta, data } = parsed.data;
      const a = data.attributes;

      if (eventName === 'order_refunded') {
        return {
          kind: 'refunded',
          eventId,
          eventName,
          providerOrderId: data.id,
          providerVariantId: a.first_order_item.variant_id,
          occurredAt: new Date(a.refunded_at ?? a.updated_at),
        };
      }
      if (a.status !== 'paid') return { kind: 'ignored', eventId, eventName };
      return {
        kind: 'paid',
        eventId,
        eventName,
        orderRef: meta.custom_data?.order_ref ?? null,
        providerOrderId: data.id,
        providerCustomerId: a.customer_id,
        providerVariantId: a.first_order_item.variant_id,
        email: a.user_email,
        money: lsMoney(a),
        occurredAt: new Date(a.created_at),
      };
    },

    async createCheckout(req) {
      if (!cfg.apiKey || !cfg.storeId) throw new ProviderNotConfiguredError('LEMONSQUEEZY_API_KEY/STORE_ID');
      const res = await doFetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: { custom: { order_ref: req.orderRef } },
              checkout_options: { embed: true },
              product_options: { redirect_url: req.successUrl },
            },
            relationships: {
              store: { data: { type: 'stores', id: cfg.storeId } },
              variant: { data: { type: 'variants', id: req.providerVariantId } },
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`lemonsqueezy_checkout_failed_${res.status}`);
      const body = checkoutResponseSchema.parse(await res.json());
      return { provider: 'lemonsqueezy', url: body.data.attributes.url };
    },
  };
}
