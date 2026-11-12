import { describe, expect, it } from 'vitest';
import { ingredientSchema } from '@/validators/content';
import { formatQuantity, roundMetric, toFraction } from './format-quantity';
import { clampServings, formatIngredient, ingredientLineText, scaleFactor } from './scale';

describe('formatQuantity', () => {
  it('rounds to common Unicode fractions for volume units (TR/EN)', () => {
    expect(formatQuantity(1.5, { locale: 'en', unit: 'tsp' })).toBe('1½');
    expect(formatQuantity(0.33, { locale: 'en', unit: 'cup' })).toBe('⅓');
    expect(formatQuantity(2.74, { locale: 'tr', unit: 'su bardağı' })).toBe('2¾');
    expect(formatQuantity(0.97, { locale: 'en', unit: 'cup' })).toBe('1');
    expect(formatQuantity(0.01, { locale: 'en', unit: 'tsp' })).toBe('⅛');
  });

  it('rounds metric amounts to 1 g below 100 and 5 g above', () => {
    expect(roundMetric(12.4)).toBe(12);
    expect(roundMetric(0.2)).toBe(1);
    expect(roundMetric(337)).toBe(335);
    expect(formatQuantity(1012.5, { locale: 'en', unit: 'g' })).toBe('1,015');
    expect(formatQuantity(1012.5, { locale: 'tr', unit: 'g' })).toBe('1.015');
  });

  it('uses decimals with Arabic digits for ar', () => {
    expect(formatQuantity(2.5, { locale: 'ar', unit: 'ملعقة' })).toBe('٢٫٥');
    expect(formatQuantity(450, { locale: 'ar', unit: 'غ' })).toBe('٤٥٠');
  });

  it('carries 1 when the fraction rounds up', () => {
    expect(toFraction(1.95)).toEqual({ whole: 2, fraction: '' });
  });
});

describe('ingredient scaling', () => {
  const flour = ingredientSchema.parse({ id: 'f', quantity: 450, unit: 'g', name: 'flour' });
  const pinch = ingredientSchema.parse({ id: 's', quantity: 1, unit: 'pinch', name: 'salt', scalable: false });
  const eggs = ingredientSchema.parse({ id: 'e', quantity: 2, quantityMax: 3, name: 'eggs' });
  const taste = ingredientSchema.parse({ id: 'p', quantity: null, name: 'pepper', note: 'to taste' });

  it('scales scalable items by servings / baseServings', () => {
    expect(formatIngredient(flour, scaleFactor(24, 12), 'en').amount).toBe('900');
    expect(formatIngredient(flour, scaleFactor(6, 12), 'en').amount).toBe('225');
  });

  it('never scales non-scalable items', () => {
    expect(formatIngredient(pinch, 3, 'en').amount).toBe('1');
  });

  it('scales both ends of a range', () => {
    expect(formatIngredient(eggs, 2, 'en').amount).toBe('4–6');
  });

  it('renders null quantities as name only', () => {
    const line = formatIngredient(taste, 2, 'en');
    expect(line.amount).toBeNull();
    expect(ingredientLineText(line)).toBe('pepper (to taste)');
  });

  it('clamps servings to 1–48', () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(100)).toBe(48);
    expect(clampServings(Number.NaN)).toBe(1);
  });
});
