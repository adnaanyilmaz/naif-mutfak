import { describe, expect, it } from 'vitest';
import type { AdminPostRecord } from '@/repositories/admin-posts';
import { slugify } from '@/services/content/slug';
import { savePostInputSchema } from '@/validators/admin/post';
import { copyStructure, emptyTranslation, issueLocale, parseNumber, toPostForm, toSaveInput } from './post-form';
import { diffStructure, publishIssues, translationCompleteness, type RuleShared, type RuleTranslation } from './post-rules';

const shared: RuleShared = { isRecipe: true, baseServings: 8, prepMinutes: 20, cookMinutes: 35, restMinutes: null, category: 'bread' };
const ctx = { heroImageKey: 'posts/p/hero.jpg', mediaBaseUrl: 'https://media.naifmutfak.com', siteUrl: 'https://naifmutfak.com' };
const tr: RuleTranslation = {
  locale: 'tr',
  title: 'Ekşi Mayalı Ekmek',
  slug: 'eksi-mayali-ekmek',
  dek: 'Çıtır kabuk.',
  bodyMd: '',
  ingredients: [{ items: [{ id: 'flour', quantity: 500, unit: 'g', name: 'un', scalable: true }] }],
  instructions: [{ steps: [{ id: 's1', text: 'Karıştır.' }] }],
  keywords: [],
  cuisine: null,
};

describe('slugify', () => {
  it('transliterates Turkish and Arabic', () => {
    expect(slugify('Ekşi Mayalı Köy Ekmeği', 'tr')).toBe('eksi-mayali-koy-ekmegi');
    expect(slugify('İstanbul Çöreği', 'tr')).toBe('istanbul-coregi');
    expect(slugify('Crème brûlée — 2x!', 'en')).toBe('creme-brulee-2x');
    expect(slugify('خبز العجين المخمر', 'ar')).toBe('khbz-alajyn-almkhmr');
    expect(slugify('   ', 'en')).toBe('');
  });
});

describe('publishIssues', () => {
  it('passes a complete recipe (JSON-LD dry run included)', () => {
    expect(publishIssues(shared, tr, ctx)).toEqual([]);
  });

  it('requires dek, ingredients, method, servings and a hero image for recipes', () => {
    const issues = publishIssues({ ...shared, baseServings: null }, { ...tr, dek: ' ', ingredients: null, instructions: [] }, { ...ctx, heroImageKey: null });
    expect(issues.map((i) => i.code).sort()).toEqual(
      ['publish_dek', 'publish_hero', 'publish_ingredients', 'publish_instructions', 'publish_servings'].sort(),
    );
    expect(issues.find((i) => i.code === 'publish_dek')?.path).toBe('translations.tr.dek');
  });

  it('requires a body for non-recipe posts', () => {
    expect(publishIssues({ ...shared, isRecipe: false }, { ...tr, bodyMd: '' }, ctx).map((i) => i.code)).toEqual(['publish_body']);
  });

  it('drives completeness dots', () => {
    expect(translationCompleteness(shared, undefined, ctx)).toBe('empty');
    expect(translationCompleteness(shared, tr, ctx)).toBe('complete');
    expect(translationCompleteness(shared, { ...tr, dek: null }, ctx)).toBe('partial');
  });
});

describe('diffStructure', () => {
  it('warns when ids or quantities differ from TR', () => {
    const en = { ...tr, locale: 'en' as const, ingredients: [{ items: [{ id: 'flour', quantity: 450, unit: 'g', name: 'flour', scalable: true }] }] };
    const ar = { ...tr, locale: 'ar' as const, instructions: [{ steps: [{ id: 'other', text: 'x' }] }] };
    expect(diffStructure([tr, en, ar])).toEqual([
      { locale: 'en', kind: 'ingredient_quantity', id: 'flour' },
      { locale: 'ar', kind: 'step_ids' },
    ]);
    expect(diffStructure([tr, { ...tr, locale: 'en' }])).toEqual([]);
  });
});

const record: AdminPostRecord = {
  id: '7b0c6c1e-0000-4000-8000-000000000a01',
  status: 'draft',
  category: 'bread',
  heroImageKey: null,
  isRecipe: true,
  prepMinutes: 20,
  cookMinutes: 35,
  restMinutes: null,
  baseServings: 8,
  difficulty: 'medium',
  featuredProductId: null,
  publishedAt: null,
  updatedAt: new Date('2026-11-12T10:00:00Z'),
  translations: [
    {
      locale: 'tr',
      slug: 'eksi',
      title: 'Ekşi',
      dek: null,
      bodyMd: 'Metin',
      heroImageAlt: null,
      seoTitle: null,
      seoDescription: null,
      ingredients: [{ title: 'Hamur', items: [{ id: 'flour', quantity: 1.5, unit: 'kg', unitGrams: 1000, name: 'un', note: 'tam', scalable: true }] }],
      instructions: [{ steps: [{ id: 's1', text: 'Yoğur.', timerSeconds: 600, imageKey: 'posts/x/y.jpg' }] }],
      keywords: ['ekmek', 'maya'],
      cuisine: 'Türk',
      isPublished: false,
    },
  ],
};

describe('post form model', () => {
  it('round-trips a stored post through the form into a valid save payload', () => {
    const form = toPostForm(record);
    expect(form.translations.tr?.instructions[0]?.steps[0]?.timerMinutes).toBe('10');
    const input = savePostInputSchema.parse(toSaveInput(form, record.id, 1_700_000_000));
    expect(input.translations).toHaveLength(1);
    expect(input.translations[0]).toMatchObject({
      dek: null,
      keywords: ['ekmek', 'maya'],
      ingredients: record.translations[0]?.ingredients,
      instructions: record.translations[0]?.instructions,
    });
    expect(input.post).toMatchObject({ baseServings: 8, restMinutes: null, difficulty: 'medium', featuredProductId: null });
  });

  it('skips untouched locales and rejects garbage numbers with a path', () => {
    const form = toPostForm(record);
    form.translations.en = emptyTranslation('en');
    form.shared.prepMinutes = 'abc';
    const result = savePostInputSchema.safeParse(toSaveInput(form, record.id, 1));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path.join('.')).toBe('post.prepMinutes');
    expect(toSaveInput(toPostForm(record), record.id, 1).translations.map((t) => t.locale)).toEqual(['tr']);
  });

  it('copies structure from TR with blank names but shared ids and quantities', () => {
    const form = toPostForm(record);
    const source = form.translations.tr;
    if (!source) throw new Error('fixture');
    const copied = copyStructure(source, emptyTranslation('ar'));
    expect(copied.ingredients[0]?.items[0]).toMatchObject({ id: 'flour', quantity: '1.5', unit: 'kg', name: '', note: '' });
    expect(copied.instructions[0]?.steps[0]).toMatchObject({ id: 's1', text: '', timerMinutes: '10' });
  });

  it('parses decimal commas and maps issue paths to locales', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber(' ')).toBeNull();
    expect(issueLocale('translations.1.title', ['tr', 'ar'])).toBe('ar');
    expect(issueLocale('translations.en.dek', [])).toBe('en');
    expect(issueLocale('post.status', ['tr'])).toBeNull();
  });
});
