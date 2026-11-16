/**
 * Single source of truth for recipe categories. The slug is what `posts.category` stores,
 * what category URLs use, and the message key under `Categories`; array order is display order.
 * Labels live in `messages/*.json` (Turkish is complete; an empty string means "translation pending").
 */
export const CATEGORY_KEYS = [
  'ekmekler',
  'pogaca-acma-corek',
  'borek-katmer',
  'tatlilar',
  'kekler',
  'kurabiyeler',
  'kahvaltiliklar',
  'ana-yemekler',
  'pizza-sokak-lezzetleri',
  'corba-meze-salata',
  'peynir-tursu-konserve',
  'icecekler',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface Category {
  slug: CategoryKey;
  /** 1-based display order. */
  order: number;
}

export const CATEGORIES: readonly Category[] = CATEGORY_KEYS.map((slug, i) => ({ slug, order: i + 1 }));

export const DEFAULT_CATEGORY: CategoryKey = 'ekmekler';

/** Resolves a stored value or URL segment to a known category; null when it is not one. */
export function findCategory(value: string): CategoryKey | null {
  return CATEGORY_KEYS.find((k) => k === value) ?? null;
}

/** Keeps only categories that have at least one post, in display order. */
export function categoriesWithPosts(counts: ReadonlyArray<{ category: string; count: number }>): CategoryKey[] {
  const used = new Set(counts.filter((c) => c.count > 0).map((c) => c.category));
  return CATEGORY_KEYS.filter((k) => used.has(k));
}
