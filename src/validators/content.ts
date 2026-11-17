import { z } from 'zod';

export const LOCALES = ['tr', 'en', 'ar'] as const;
export const CURRENCIES = ['TRY', 'USD', 'SAR'] as const;
export const VIDEO_MODES = ['button', 'auto'] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];

export type Locale = (typeof LOCALES)[number];
export type Currency = (typeof CURRENCIES)[number];

export const localeSchema = z.enum(LOCALES);
export const currencySchema = z.enum(CURRENCIES);

export const ingredientSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().positive().nullable(),
  quantityMax: z.number().positive().optional(),
  unit: z.string().max(24).optional(),
  unitGrams: z.number().positive().optional(),
  name: z.string().min(1).max(200),
  note: z.string().max(200).optional(),
  scalable: z.boolean().default(true),
});

export const ingredientGroupSchema = z.object({
  title: z.string().max(120).optional(),
  items: z.array(ingredientSchema).min(1),
});

export const ingredientsSchema = z.array(ingredientGroupSchema).max(20);

export const instructionStepSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
  imageKey: z.string().optional(),
  timerSeconds: z.number().int().positive().optional(),
});

export const instructionSectionSchema = z.object({
  title: z.string().max(120).optional(),
  steps: z.array(instructionStepSchema).min(1),
});

export const instructionsSchema = z.array(instructionSectionSchema).max(20);

export const utmSchema = z.object({
  source: z.string().max(100).optional(),
  medium: z.string().max(100).optional(),
  campaign: z.string().max(100).optional(),
});

export type Ingredients = z.infer<typeof ingredientsSchema>;
export type Instructions = z.infer<typeof instructionsSchema>;
export type Utm = z.infer<typeof utmSchema>;
