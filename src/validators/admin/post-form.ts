// Editor form model: every field explicit and string-typed for inputs. Also parses localStorage drafts.
import { z } from 'zod';
import { CATEGORY_KEYS } from '@/services/content/category';
import { localeSchema, VIDEO_MODES } from '@/validators/content';
import { DIFFICULTIES, POST_STATUSES } from './post';

export const ingredientRowSchema = z.object({
  id: z.string(),
  quantity: z.string(),
  quantityMax: z.string(),
  unit: z.string(),
  unitGrams: z.string(),
  name: z.string(),
  note: z.string(),
  scalable: z.boolean(),
});

export const ingredientGroupFormSchema = z.object({
  key: z.string(),
  title: z.string(),
  items: z.array(ingredientRowSchema),
});

export const stepFormSchema = z.object({
  id: z.string(),
  text: z.string(),
  imageKey: z.string().nullable(),
  timerMinutes: z.string(),
});

export const sectionFormSchema = z.object({
  key: z.string(),
  title: z.string(),
  steps: z.array(stepFormSchema),
});

export const translationFormSchema = z.object({
  locale: localeSchema,
  title: z.string(),
  slug: z.string(),
  dek: z.string(),
  bodyMd: z.string(),
  heroImageAlt: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  keywords: z.string(),
  cuisine: z.string(),
  isPublished: z.boolean(),
  ingredients: z.array(ingredientGroupFormSchema),
  instructions: z.array(sectionFormSchema),
});

export const sharedFormSchema = z.object({
  status: z.enum(POST_STATUSES),
  category: z.enum(CATEGORY_KEYS),
  isRecipe: z.boolean(),
  prepMinutes: z.string(),
  cookMinutes: z.string(),
  restMinutes: z.string(),
  baseServings: z.string(),
  difficulty: z.enum(['', ...DIFFICULTIES]),
  featuredProductId: z.string(),
  // Defaults keep localStorage drafts saved before the video fields existed restorable.
  youtubeUrl: z.string().default(''),
  videoMode: z.enum(VIDEO_MODES).default('button'),
});

export const postFormSchema = z.object({
  shared: sharedFormSchema,
  translations: z.object({
    tr: translationFormSchema.nullable(),
    en: translationFormSchema.nullable(),
    ar: translationFormSchema.nullable(),
  }),
});

/** localStorage `nm:admin:draft:{postId}`. */
export const storedDraftSchema = z.object({
  baseUpdatedAt: z.number(),
  savedAt: z.number(),
  form: postFormSchema,
});

export type IngredientRow = z.infer<typeof ingredientRowSchema>;
export type IngredientGroupForm = z.infer<typeof ingredientGroupFormSchema>;
export type StepForm = z.infer<typeof stepFormSchema>;
export type SectionForm = z.infer<typeof sectionFormSchema>;
export type TranslationForm = z.infer<typeof translationFormSchema>;
export type SharedForm = z.infer<typeof sharedFormSchema>;
export type PostForm = z.infer<typeof postFormSchema>;
export type StoredDraft = z.infer<typeof storedDraftSchema>;
