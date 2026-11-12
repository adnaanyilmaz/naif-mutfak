import { z } from 'zod';
import { CURRENCIES, LOCALES } from '@/validators/content';

/** `searchParams` values may be repeated; take the first. Empty string = unset. */
const param = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    const first = Array.isArray(v) ? v[0] : v;
    return first === '' ? undefined : first;
  }, schema.optional());

const common = {
  from: param(z.iso.date()),
  to: param(z.iso.date()),
  bucket: param(z.enum(['day', 'week', 'month'])),
  cursor: param(z.string().max(200)),
};

export const salesQuerySchema = z.object({
  ...common,
  status: param(z.enum(['pending', 'paid', 'refunded', 'failed'])),
  provider: param(z.enum(['lemonsqueezy', 'paddle'])),
  currency: param(z.enum(CURRENCIES)),
  product: param(z.guid()),
});

export const subscribersQuerySchema = z.object({
  ...common,
  status: param(z.enum(['pending', 'active', 'unsubscribed', 'bounced'])),
  locale: param(z.enum(LOCALES)),
  source: param(z.enum(['footer', 'recipe_card', 'ebook_callout', 'popup', 'checkout'])),
});

export const exportQuerySchema = z.object({
  unmasked: param(z.literal('1')),
});

export const revealEmailInputSchema = z.object({ orderId: z.string().min(1).max(64) });

export type SalesQuery = z.infer<typeof salesQuerySchema>;
export type SubscribersQuery = z.infer<typeof subscribersQuerySchema>;
