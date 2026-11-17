// Admin auto-translation (TR → EN/AR): action input, model I/O, and the stored check report.
import { z } from 'zod';

export const TARGET_LOCALES = ['en', 'ar'] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export const translateInputSchema = z.object({
  postId: z.guid(),
  locale: z.enum(TARGET_LOCALES),
  overwrite: z.boolean().default(false),
});

export const CHECK_CODES = [
  'missing_item',
  'untranslated',
  'clamped',
  'wrong_script',
  'numbers',
  'body_headings',
  'body_lists',
  'body_directives',
  'body_links',
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

export const translationCheckSchema = z.object({ code: z.enum(CHECK_CODES), field: z.string().max(80) });

export const reviewIssueSchema = z.object({
  severity: z.enum(['error', 'warning']),
  field: z.string().max(80),
  message: z.string().max(400),
});

export const translationReportSchema = z.object({
  checks: z.array(translationCheckSchema).max(50),
  review: z.array(reviewIssueSchema).max(20),
  /** false when the AI review call failed (quota, model error); the translation is still saved. */
  reviewed: z.boolean(),
});

const text = z.string().nullable();

/** Strings-only view of a recipe sent to the model. Ids pair results back; numbers never leave the server. */
export const modelPayloadSchema = z.object({
  title: z.string().min(1),
  dek: text,
  heroImageAlt: text,
  seoTitle: text,
  seoDescription: text,
  cuisine: text,
  keywords: z.array(z.string()),
  /** Ingredient group titles, by group index. */
  groupTitles: z.array(text),
  ingredients: z.array(z.object({ id: z.string(), name: z.string(), unit: text, note: text })),
  /** Instruction section titles, by section index. */
  sectionTitles: z.array(text),
  steps: z.array(z.object({ id: z.string(), text: z.string() })),
});

/** Review model output; lengths are clamped by the service before storing. */
export const modelReviewSchema = z.object({
  issues: z.array(z.object({ severity: z.enum(['error', 'warning']), field: z.string(), message: z.string() })),
});

export type TranslateInput = z.infer<typeof translateInputSchema>;
export type TranslationCheck = z.infer<typeof translationCheckSchema>;
export type ReviewIssue = z.infer<typeof reviewIssueSchema>;
export type TranslationReport = z.infer<typeof translationReportSchema>;
export type ModelPayload = z.infer<typeof modelPayloadSchema>;
