import { describe, expect, it } from 'vitest';
import type { AdminPostRecord, AdminTranslation, AiTranslationMeta } from '@/repositories/admin-posts';
import { toPostForm, toSaveInput } from '@/services/admin/post-form';
import { savePostInputSchema } from '@/validators/admin/post';
import { contentHash, describeTranslation } from './content-hash';
import { trSource } from './fixtures';

const en: AdminTranslation = { ...trSource, locale: 'en', slug: 'bread', title: 'Bread', isPublished: false };
const report = { checks: [], review: [], reviewed: true };

describe('contentHash', () => {
  it('is a 64-char hex digest that follows the text', async () => {
    const h = await contentHash(trSource);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    const steps = trSource.instructions?.map((s) => ({ ...s, steps: s.steps.map((st) => ({ ...st, text: `${st.text}!` })) })) ?? null;
    expect(await contentHash({ ...trSource, instructions: steps })).not.toBe(h);
  });

  it('ignores numbers, slug, publish state and null-vs-empty', async () => {
    const h = await contentHash(trSource);
    const ingredients = trSource.ingredients?.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, quantity: 1 })) })) ?? null;
    const instructions = trSource.instructions?.map((s) => ({ ...s, steps: s.steps.map((st) => ({ ...st, timerSeconds: 5 })) })) ?? null;
    expect(await contentHash({ ...trSource, ingredients, instructions, slug: 'x', isPublished: false })).toBe(h);
    expect(await contentHash({ ...trSource, dek: null })).toBe(await contentHash({ ...trSource, dek: '' }));
  });

  it('survives the editor round-trip (form → save input)', async () => {
    const tr: AdminTranslation = {
      ...trSource,
      ingredients: [{ items: [{ id: 'egg', quantity: 2, name: 'yumurta', scalable: true }] }],
      instructions: [{ steps: [{ id: 's1', text: 'Çırpın.', timerSeconds: 90 }] }],
    };
    const record: AdminPostRecord = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'draft',
      category: 'ekmekler',
      heroImageKey: null,
      isRecipe: true,
      prepMinutes: null,
      cookMinutes: null,
      restMinutes: null,
      baseServings: 4,
      difficulty: null,
      featuredProductId: null,
      publishedAt: null,
      updatedAt: new Date(0),
      translations: [tr, { ...en, dek: null, seoTitle: null }],
      aiMeta: {},
    };
    const input = savePostInputSchema.parse(toSaveInput(toPostForm(record), record.id, 0));
    for (const original of record.translations) {
      const saved = input.translations.find((t) => t.locale === original.locale);
      expect(saved).toBeDefined();
      if (saved) expect(await contentHash(saved)).toBe(await contentHash(original));
    }
  });
});

describe('describeTranslation', () => {
  const meta = async (over: Partial<AiTranslationMeta> = {}): Promise<AiTranslationMeta> => ({
    sourceHash: await contentHash(trSource),
    contentHash: await contentHash(en),
    report,
    translatedAt: new Date(0),
    ...over,
  });

  it('derives origin from metadata and the content hash', async () => {
    expect(await describeTranslation(trSource, undefined, undefined)).toEqual({ origin: 'none', outdated: false, report: null });
    expect(await describeTranslation(trSource, en, undefined)).toEqual({ origin: 'manual', outdated: false, report: null });
    expect(await describeTranslation(trSource, en, await meta())).toEqual({ origin: 'ai', outdated: false, report });
    expect((await describeTranslation(trSource, { ...en, title: 'Loaf' }, await meta())).origin).toBe('ai_edited');
  });

  it('marks a translation out of date when the Turkish text changed', async () => {
    expect((await describeTranslation({ ...trSource, title: 'Yeni' }, en, await meta())).outdated).toBe(true);
    expect((await describeTranslation(undefined, en, await meta())).outdated).toBe(false);
  });
});
