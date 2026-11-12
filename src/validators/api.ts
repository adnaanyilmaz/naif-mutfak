import { z } from 'zod';
import { localeSchema, utmSchema } from './content';

export const SUBSCRIBER_SOURCES = ['footer', 'recipe_card', 'ebook_callout', 'popup', 'checkout'] as const;

/** POST /api/subscribers — `checkout` is server-only (webhook), never accepted from the browser. */
export const subscribeInputSchema = z.object({
  email: z.email().max(254),
  locale: localeSchema,
  source: z.enum(['footer', 'recipe_card', 'ebook_callout', 'popup']),
  consent: z.literal(true),
  referrerPath: z
    .string()
    .max(300)
    .regex(/^\/(?!\/)[^\s?#]*$/)
    .nullish()
    .transform((v) => v ?? null),
  utm: utmSchema.nullish().transform((v) => v ?? null),
});

/** POST /api/checkout — price, currency and email are never accepted from the client. */
export const checkoutInputSchema = z.object({
  variantId: z.uuid(),
  locale: localeSchema,
});

/** GET /api/download/[token] */
export const downloadTokenParamSchema = z
  .string()
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export type SubscribeInputBody = z.infer<typeof subscribeInputSchema>;
