import type { Ingredients, Locale } from '@/validators/content';
import { formatQuantity } from './format-quantity';

type Ingredient = Ingredients[number]['items'][number];

export const SERVING_MULTIPLIERS = [0.5, 1, 2, 3] as const;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 48;

export interface IngredientLine {
  id: string;
  /** Formatted amount ("1½", "450", "٢٫٥", "2–3") or null for "to taste". */
  amount: string | null;
  unit: string | null;
  name: string;
  note: string | null;
}

export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(servings)));
}

export function scaleFactor(servings: number, baseServings: number): number {
  return baseServings > 0 ? servings / baseServings : 1;
}

export function formatIngredient(item: Ingredient, factor: number, locale: Locale): IngredientLine {
  const f = item.scalable ? factor : 1;
  let amount: string | null = null;
  if (item.quantity !== null) {
    const min = formatQuantity(item.quantity * f, { locale, unit: item.unit });
    amount =
      item.quantityMax !== undefined ? `${min}–${formatQuantity(item.quantityMax * f, { locale, unit: item.unit })}` : min;
  }
  return { id: item.id, amount, unit: item.unit ?? null, name: item.name, note: item.note ?? null };
}

export function ingredientLineText(line: IngredientLine): string {
  const head = [line.amount, line.unit, line.name].filter((p): p is string => p !== null && p !== '').join(' ');
  return line.note ? `${head} (${line.note})` : head;
}

export interface IngredientGroupView {
  title: string | null;
  items: IngredientLine[];
}

export function formatIngredientGroups(groups: Ingredients, factor: number, locale: Locale): IngredientGroupView[] {
  return groups.map((g) => ({
    title: g.title ?? null,
    items: g.items.map((i) => formatIngredient(i, factor, locale)),
  }));
}
