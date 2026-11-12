import { z } from 'zod';
import { localeSchema } from './content';

/** GET /api/orders/status response, parsed in the browser while polling. */
export const orderViewSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('no_order') }),
  z.object({
    state: z.enum(['pending', 'paid', 'refunded', 'failed']),
    orderRef: z.string(),
    productTitle: z.string(),
    productSlug: z.string(),
    edition: localeSchema,
    total: z.string(),
    downloadsLeft: z.number().int(),
  }),
]);

export const orderStatusResponseSchema = z.object({ ok: z.literal(true), order: orderViewSchema });
export const downloadTokenResponseSchema = z.object({ ok: z.literal(true), url: z.string().startsWith('/api/download/') });

export type OrderView = z.infer<typeof orderViewSchema>;
