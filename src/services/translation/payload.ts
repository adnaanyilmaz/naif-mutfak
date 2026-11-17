// Strings-only model payload and the id-safe merge back into a recipe. Numbers, ids, timers and images
// always come from the Turkish source; the model can only change human-readable text.
import type { AdminTranslation } from '@/repositories/admin-posts';
import type { ModelPayload, TranslationCheck } from '@/validators/admin/translation';

export type TranslatedContent = Omit<AdminTranslation, 'locale' | 'slug' | 'isPublished' | 'bodyMd'>;

/** Column / schema limits (validators/admin/post.ts, validators/content.ts). */
const LIMIT = {
  title: 200,
  dek: 400,
  heroImageAlt: 300,
  seoTitle: 120,
  seoDescription: 320,
  cuisine: 80,
  keyword: 60,
  keywords: 20,
  name: 200,
  unit: 24,
  note: 200,
  groupTitle: 120,
  stepText: 2000,
} as const;

export function toPayload(source: AdminTranslation): ModelPayload {
  const groups = source.ingredients ?? [];
  const sections = source.instructions ?? [];
  return {
    title: source.title,
    dek: source.dek,
    heroImageAlt: source.heroImageAlt,
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    cuisine: source.cuisine,
    keywords: source.keywords,
    groupTitles: groups.map((g) => g.title ?? null),
    ingredients: groups.flatMap((g) => g.items.map((i) => ({ id: i.id, name: i.name, unit: i.unit ?? null, note: i.note ?? null }))),
    sectionTitles: sections.map((s) => s.title ?? null),
    steps: sections.flatMap((s) => s.steps.map((st) => ({ id: st.id, text: st.text }))),
  };
}

/** Cuts at the last whitespace before `max` (hard cut when there is none). */
function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  const space = cut.search(/\s\S*$/);
  return (space > 0 ? cut.slice(0, space) : value.slice(0, max)).trimEnd();
}

/** Optional titles stay absent rather than undefined (exactOptionalPropertyTypes). */
function withTitle(title: string | null): { title?: string } {
  return title === null ? {} : { title };
}

export function mergePayload(source: AdminTranslation, model: ModelPayload): { content: TranslatedContent; checks: TranslationCheck[] } {
  const checks: TranslationCheck[] = [];

  const text = (value: string | null | undefined, max: number, field: string): string | null => {
    const v = value?.trim() ?? '';
    if (!v) return null;
    if (v.length > max) checks.push({ code: 'clamped', field });
    return clampText(v, max);
  };

  const missing = (field: string) => {
    if (!checks.some((c) => c.code === 'missing_item' && c.field === field)) checks.push({ code: 'missing_item', field });
  };
  /** Translated text for a source value that exists; an empty translation keeps the source text and is reported. */
  const keep = (sourceValue: string | undefined, translated: string | null | undefined, max: number, field: string): string | null => {
    if (sourceValue === undefined || !sourceValue.trim()) return null;
    const v = text(translated, max, field);
    if (v !== null) return v;
    missing(field);
    return sourceValue;
  };

  const names = new Map(model.ingredients.map((i) => [i.id, i]));
  const steps = new Map(model.steps.map((s) => [s.id, s]));

  const ingredients =
    source.ingredients?.map((g, gi) => ({
      ...withTitle(keep(g.title, model.groupTitles[gi], LIMIT.groupTitle, `ingredients.groups.${gi}`)),
      items: g.items.map((item) => {
        const field = `ingredients.${item.id}`;
        const m = names.get(item.id);
        const name = keep(item.name, m?.name, LIMIT.name, field) ?? item.name;
        const unit = keep(item.unit, m?.unit, LIMIT.unit, field);
        const note = keep(item.note, m?.note, LIMIT.note, field);
        const { unit: _unit, note: _note, ...rest } = item;
        return { ...rest, name, ...(unit === null ? {} : { unit }), ...(note === null ? {} : { note }) };
      }),
    })) ?? null;

  const instructions =
    source.instructions?.map((s, si) => ({
      ...withTitle(keep(s.title, model.sectionTitles[si], LIMIT.groupTitle, `instructions.sections.${si}`)),
      steps: s.steps.map((step) => {
        const translated = text(steps.get(step.id)?.text, LIMIT.stepText, `steps.${step.id}`);
        if (!translated) checks.push({ code: 'missing_item', field: `steps.${step.id}` });
        return { ...step, text: translated ?? step.text };
      }),
    })) ?? null;

  const keywords = model.keywords
    .map((k) => text(k, LIMIT.keyword, 'keywords'))
    .filter((k): k is string => k !== null)
    .slice(0, LIMIT.keywords);

  return {
    content: {
      title: text(model.title, LIMIT.title, 'title') ?? source.title,
      dek: text(model.dek, LIMIT.dek, 'dek'),
      heroImageAlt: text(model.heroImageAlt, LIMIT.heroImageAlt, 'heroImageAlt'),
      seoTitle: text(model.seoTitle, LIMIT.seoTitle, 'seoTitle'),
      seoDescription: text(model.seoDescription, LIMIT.seoDescription, 'seoDescription'),
      cuisine: text(model.cuisine, LIMIT.cuisine, 'cuisine'),
      keywords,
      ingredients,
      instructions,
    },
    checks,
  };
}
