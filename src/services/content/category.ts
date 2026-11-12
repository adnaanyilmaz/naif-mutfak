export const CATEGORY_KEYS = ['bread', 'pastry'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number] | 'other';

/** Maps a stored category to a message key under `Categories`. */
export function categoryKey(category: string): CategoryKey {
  return CATEGORY_KEYS.find((k) => k === category) ?? 'other';
}
