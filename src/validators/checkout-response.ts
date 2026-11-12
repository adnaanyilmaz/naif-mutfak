import { z } from 'zod';
import { localeSchema } from './content';

/** Response of POST /api/checkout, parsed in the browser before opening the overlay. */
export const checkoutResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    checkout: z.discriminatedUnion('provider', [
      z.object({ provider: z.literal('lemonsqueezy'), url: z.url() }),
      z.object({
        provider: z.literal('paddle'),
        priceId: z.string().min(1),
        clientToken: z.string().min(1),
        environment: z.enum(['sandbox', 'production']),
        customData: z.object({ order_ref: z.string() }),
        locale: localeSchema,
      }),
    ]),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
