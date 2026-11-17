import { describe, expect, it } from 'vitest';
import { modelPayloadSchema } from '@/validators/admin/translation';
import { postTranslationInputSchema } from '@/validators/admin/post';
import { enPayload, trSource } from './fixtures';
import { mergePayload, toPayload, type TranslatedContent } from './payload';

const validRow = (content: TranslatedContent) =>
  postTranslationInputSchema.safeParse({ ...content, locale: 'en', slug: 'x', bodyMd: '', isPublished: false }).success;

describe('toPayload', () => {
  it('sends strings only, never quantities', () => {
    const payload = toPayload(trSource);
    expect(modelPayloadSchema.safeParse(payload).success).toBe(true);
    const json = JSON.stringify(payload);
    expect(json).not.toContain('500');
    expect(json).not.toContain('600');
    expect(payload.ingredients.map((i) => i.id)).toEqual(['flour', 'salt']);
  });
});

describe('mergePayload', () => {
  it('pairs by id and keeps the source structure and numbers', () => {
    const p = enPayload();
    const { content, checks } = mergePayload(trSource, { ...p, ingredients: [...p.ingredients].reverse() });
    const items = content.ingredients?.[0]?.items ?? [];
    expect(items.map((i) => [i.id, i.name, i.quantity])).toEqual([
      ['flour', 'flour', 500],
      ['salt', 'salt', 10],
    ]);
    expect(items[1]?.note).toBe('fine');
    expect(content.instructions?.[0]?.steps[0]).toEqual({ id: 's1', text: 'Bake at 180°C for 25 minutes.', timerSeconds: 600 });
    expect(content.ingredients?.[0]?.title).toBe('Dough');
    expect(checks).toEqual([]);
    expect(validRow(content)).toBe(true);
  });

  it('keeps source text and reports missing or empty items', () => {
    const p = enPayload();
    const { content, checks } = mergePayload(trSource, {
      ...p,
      ingredients: p.ingredients.filter((i) => i.id !== 'salt'),
      steps: [{ id: 's1', text: 'Bake.' }, { id: 's2', text: '  ' }],
    });
    expect(content.ingredients?.[0]?.items[1]?.name).toBe('tuz');
    expect(content.instructions?.[0]?.steps[1]?.text).toBe('Soğumaya bırakın.');
    expect(checks).toEqual([
      { code: 'missing_item', field: 'ingredients.salt' },
      { code: 'missing_item', field: 'steps.s2' },
    ]);
    expect(validRow(content)).toBe(true);
  });

  it('ignores ids the source does not have', () => {
    const p = enPayload();
    const { content } = mergePayload(trSource, { ...p, ingredients: [...p.ingredients, { id: 'sugar', name: 'sugar', unit: null, note: null }] });
    expect(content.ingredients?.[0]?.items.map((i) => i.id)).toEqual(['flour', 'salt']);
  });

  it('clamps over-long fields at a word boundary', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ');
    const { content, checks } = mergePayload(trSource, enPayload({ seoTitle: long }));
    expect(content.seoTitle?.length).toBeLessThanOrEqual(120);
    expect(long.startsWith(`${content.seoTitle ?? ''} `)).toBe(true);
    expect(checks).toContainEqual({ code: 'clamped', field: 'seoTitle' });
    expect(validRow(content)).toBe(true);
  });

  it('normalises blanks to null/absent and drops empty keywords', () => {
    const p = enPayload({ dek: '  ', keywords: ['bread', ' ', ''] });
    const { content } = mergePayload(trSource, { ...p, ingredients: [{ id: 'flour', name: 'flour', unit: ' ', note: '' }, p.ingredients[1]!] });
    expect(content.dek).toBeNull();
    expect(content.keywords).toEqual(['bread']);
    expect(content.ingredients?.[0]?.items[0]).not.toHaveProperty('unit');
    expect(content.ingredients?.[0]?.items[0]).not.toHaveProperty('note');
    expect(validRow(content)).toBe(true);
  });
});
