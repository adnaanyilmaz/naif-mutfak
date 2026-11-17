import { describe, expect, it } from 'vitest';
import type { AdminTranslation } from '@/repositories/admin-posts';
import { runChecks } from './checks';
import { trSource } from './fixtures';

const en: AdminTranslation = {
  ...trSource,
  locale: 'en',
  slug: 'sourdough-bread',
  title: 'Sourdough Bread',
  dek: 'A crusty village loaf.',
  bodyMd: '## Dough\n\nMix the flour with 500 g water.\n\n- Flour\n- Water',
  ingredients: [{ title: 'Dough', items: [{ id: 'flour', quantity: 500, unit: 'g', name: 'flour', scalable: true }, { id: 'salt', quantity: 10, unit: 'g', name: 'salt', note: 'fine', scalable: true }] }],
  instructions: [{ title: 'Method', steps: [{ id: 's1', text: 'Bake at 180°C for 25 minutes.', timerSeconds: 600 }, { id: 's2', text: 'Leave to cool.' }] }],
};

const withStep = (t: AdminTranslation, id: string, text: string): AdminTranslation => ({
  ...t,
  instructions: (t.instructions ?? []).map((s) => ({ ...s, steps: s.steps.map((st) => (st.id === id ? { ...st, text } : st)) })),
});

describe('runChecks', () => {
  it('passes a faithful translation', () => {
    expect(runChecks(trSource, en)).toEqual([]);
  });

  it('flags changed numbers per step', () => {
    expect(runChecks(trSource, withStep(en, 's1', 'Bake at 180°C for 20 minutes.'))).toEqual([{ code: 'numbers', field: 'steps.s1' }]);
  });

  it('treats Arabic-Indic digits as the same numbers', () => {
    const ar: AdminTranslation = {
      ...withStep(withStep(en, 's1', 'اخبز على حرارة ١٨٠ درجة لمدة ٢٥ دقيقة.'), 's2', 'اتركه ليبرد.'),
      locale: 'ar',
      title: 'خبز العجين المخمر',
      dek: 'رغيف قروي مقرمش.',
      bodyMd: '## العجين\n\nاخلط الدقيق مع ٥٠٠ غ ماء.\n\n- دقيق\n- ماء',
    };
    expect(runChecks(trSource, ar)).toEqual([]);
  });

  it('flags Latin text in an Arabic translation', () => {
    const ar: AdminTranslation = { ...en, locale: 'ar', title: 'Sourdough Bread', dek: null, bodyMd: '', instructions: null };
    expect(runChecks({ ...trSource, bodyMd: '', instructions: null }, ar)).toContainEqual({ code: 'wrong_script', field: 'title' });
  });

  it('flags Arabic text in an English translation', () => {
    expect(runChecks(trSource, { ...en, dek: 'رغيف قروي مقرمش.' })).toContainEqual({ code: 'wrong_script', field: 'dek' });
  });

  it('compares Markdown structure and links', () => {
    const source = { ...trSource, bodyMd: '## A\n\n- x\n- y\n\n[l](https://a.b/c)' };
    const target = { ...en, bodyMd: '## A\n\n- x\n\n[l](https://a.b/d)' };
    const codes = runChecks(source, target).map((c) => c.code);
    expect(codes).toContain('body_lists');
    expect(codes).toContain('body_links');
    expect(codes).not.toContain('body_headings');
  });

  it('compares directives', () => {
    const source = { ...trSource, bodyMd: 'Metin\n\n::ebook{product="ekmek"}' };
    expect(runChecks(source, { ...en, bodyMd: 'Text\n\n::ebook{product="bread"}' })).toContainEqual({ code: 'body_directives', field: 'bodyMd' });
    expect(runChecks(source, { ...en, bodyMd: 'Text\n\n::ebook{product="ekmek"}' })).toEqual([]);
  });

  it('flags an untranslated title', () => {
    expect(runChecks(trSource, { ...en, title: ' ekşi mayalı EKMEK ' })).toContainEqual({ code: 'untranslated', field: 'title' });
  });

  it('flags untranslated instructions when most steps are identical', () => {
    expect(runChecks(trSource, { ...en, instructions: trSource.instructions })).toContainEqual({ code: 'untranslated', field: 'instructions' });
  });
});
