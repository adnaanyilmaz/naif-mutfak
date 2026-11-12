import { z } from 'zod';

const minor = z.coerce.number().int().nonnegative();

export const paddleEnvelopeSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  occurred_at: z.iso.datetime({ offset: true }),
});

/** `transaction.completed` */
export const paddleTransactionSchema = paddleEnvelopeSchema.extend({
  data: z.object({
    id: z.string().min(1),
    customer_id: z.string().min(1),
    currency_code: z.string().length(3),
    custom_data: z.object({ order_ref: z.string().optional() }).nullish(),
    items: z.array(z.object({ price: z.object({ id: z.string().min(1) }) })).min(1),
    details: z.object({
      totals: z.object({ subtotal: minor, tax: minor, total: minor }),
    }),
  }),
});

/** `adjustment.created` / `adjustment.updated` */
export const paddleAdjustmentSchema = paddleEnvelopeSchema.extend({
  data: z.object({
    id: z.string().min(1),
    action: z.string(),
    status: z.string(),
    transaction_id: z.string().min(1),
  }),
});

/** `GET /customers/{id}` response (only email). */
export const paddleCustomerResponseSchema = z.object({ data: z.object({ email: z.email() }) });
