import { z } from 'zod';
import { CATEGORY_KEYS } from '@/services/content/category';
import { SLUG_MAX, SLUG_PATTERN } from '@/services/content/slug';
import { YOUTUBE_ID_PATTERN } from '@/services/media/youtube';
import { ingredientsSchema, instructionsSchema, localeSchema, LOCALES, VIDEO_MODES } from '@/validators/content';

export const slugSchema = z.string().min(1).max(SLUG_MAX).regex(SLUG_PATTERN);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));
const minutes = z.number().int().min(0).max(10_080).nullable();

export const POST_STATUSES = ['draft', 'published', 'archived'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'advanced'] as const;

export const postSharedInputSchema = z.object({
  status: z.enum(POST_STATUSES),
  category: z.enum(CATEGORY_KEYS),
  isRecipe: z.boolean(),
  prepMinutes: minutes,
  cookMinutes: minutes,
  restMinutes: minutes,
  baseServings: z.number().int().min(1).max(48).nullable(),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  featuredProductId: z.guid().nullable(),
  youtubeVideoId: z.string().regex(YOUTUBE_ID_PATTERN).nullable(),
  videoMode: z.enum(VIDEO_MODES),
});

export const postTranslationInputSchema = z.object({
  locale: localeSchema,
  title: z.string().trim().min(1).max(200),
  slug: slugSchema,
  dek: nullableText(400),
  bodyMd: z.string().max(200_000),
  heroImageAlt: nullableText(300),
  seoTitle: nullableText(120),
  seoDescription: nullableText(320),
  ingredients: ingredientsSchema.nullable(),
  instructions: instructionsSchema.nullable(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20),
  cuisine: nullableText(80),
  isPublished: z.boolean(),
});

export const savePostInputSchema = z.object({
  postId: z.guid(),
  /** `posts.updated_at` (unix seconds) the editor loaded; mismatch → 409. */
  expectedUpdatedAt: z.number().int().nonnegative(),
  post: postSharedInputSchema,
  translations: z
    .array(postTranslationInputSchema)
    .max(LOCALES.length)
    .refine((ts) => new Set(ts.map((t) => t.locale)).size === ts.length, 'duplicate locale'),
});

export const checkSlugInputSchema = z.object({ postId: z.guid(), locale: localeSchema, slug: z.string().max(200) });
export const postIdSchema = z.guid();

export type PostSharedInput = z.infer<typeof postSharedInputSchema>;
export type PostTranslationInput = z.infer<typeof postTranslationInputSchema>;
export type SavePostInput = z.infer<typeof savePostInputSchema>;

const firstParam = (v: unknown) => {
  const first = Array.isArray(v) ? v[0] : v;
  return first === '' ? undefined : first;
};

export const postListQuerySchema = z.object({
  q: z.preprocess(firstParam, z.string().max(100).optional()),
  status: z.preprocess(firstParam, z.enum(POST_STATUSES).optional()),
});
