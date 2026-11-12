import { z } from 'zod';
import { localeSchema, LOCALES } from '@/validators/content';
import { slugSchema } from './post';

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));
const majorPrice = z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/);
const nullableId = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .nullable()
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || pattern.test(v));

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

export const variantInputSchema = z.object({
  /** null → new variant. */
  id: z.guid().nullable(),
  contentLocale: localeSchema,
  sku: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/),
  priceTry: majorPrice,
  priceUsd: majorPrice,
  priceSar: majorPrice,
  lsVariantId: nullableId(/^\d{1,20}$/),
  paddlePriceId: nullableId(/^pri_[a-z0-9_]{3,60}$/i),
  isActive: z.boolean(),
});

export const productTranslationInputSchema = z.object({
  locale: localeSchema,
  title: z.string().trim().min(1).max(200),
  subtitle: nullableText(300),
  descriptionMd: z.string().max(50_000),
  coverAlt: nullableText(300),
});

export const saveProductInputSchema = z.object({
  productId: z.guid(),
  expectedUpdatedAt: z.number().int().nonnegative(),
  product: z.object({
    slug: slugSchema,
    status: z.enum(PRODUCT_STATUSES),
    pageCount: z.number().int().min(1).max(5000).nullable(),
  }),
  translations: z
    .array(productTranslationInputSchema)
    .max(LOCALES.length)
    .refine((ts) => new Set(ts.map((t) => t.locale)).size === ts.length, 'duplicate locale'),
  variants: z
    .array(variantInputSchema)
    .max(LOCALES.length)
    .refine((vs) => new Set(vs.map((v) => v.contentLocale)).size === vs.length, 'duplicate edition'),
});

export const productIdSchema = z.guid();

export type VariantInput = z.infer<typeof variantInputSchema>;
export type SaveProductInput = z.infer<typeof saveProductInputSchema>;
