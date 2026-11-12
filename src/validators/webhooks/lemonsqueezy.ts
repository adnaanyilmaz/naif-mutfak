import { z } from 'zod';

const minor = z.coerce.number().int().nonnegative();

/** Lemon Squeezy order webhook (`order_created`, `order_refunded`). Only fields we use. */
export const lsOrderWebhookSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1),
    custom_data: z.object({ order_ref: z.string().optional() }).nullish(),
  }),
  data: z.object({
    type: z.string(),
    id: z.coerce.string().min(1),
    attributes: z.object({
      customer_id: z.coerce.string().min(1),
      user_email: z.string().trim().pipe(z.email()),
      currency: z.string().length(3),
      status: z.string(),
      subtotal: minor,
      tax: minor,
      total: minor,
      subtotal_usd: minor,
      tax_usd: minor,
      total_usd: minor,
      first_order_item: z.object({ variant_id: z.coerce.string().min(1) }),
      created_at: z.iso.datetime({ offset: true }),
      updated_at: z.iso.datetime({ offset: true }),
      refunded_at: z.iso.datetime({ offset: true }).nullish(),
    }),
  }),
});

/** Minimal envelope used to route events we do not handle. */
export const lsEnvelopeSchema = z.object({ meta: z.object({ event_name: z.string().min(1) }) });

export type LsOrderWebhook = z.infer<typeof lsOrderWebhookSchema>;
