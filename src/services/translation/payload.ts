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

  const names = new Map(model.ingredients.map((i) => [i.id, i]));
  const steps = new Map(model.steps.map((s) => [s.id, s]));

  const ingredients =
    source.ingredients?.map((g, gi) => ({
      ...withTitle(g.title === undefined ? null : text(model.groupTitles[gi] ?? g.title, LIMIT.groupTitle, `ingredients.groups.${gi}`)),
      items: g.items.map((item) => {
        const m = names.get(item.id);
        const name = m ? text(m.name, LIMIT.name, `ingredients.${item.id}`) : null;
        if (!name) checks.push({ code: 'missing_item', field: `ingredients.${item.id}` });
        const unit = item.unit === undefined ? null : m ? text(m.unit, LIMIT.unit, `ingredients.${item.id}`) : item.unit;
        const note = item.note === undefined ? null : m ? text(m.note, LIMIT.note, `ingredients.${item.id}`) : item.note;
        const { unit: _unit, note: _note, ...rest } = item;
        return { ...rest, name: name ?? item.name, ...(unit === null ? {} : { unit }), ...(note === null ? {} : { note }) };
      }),
    })) ?? null;

  const instructions =
    source.instructions?.map((s, si) => ({
      ...withTitle(s.title === undefined ? null : text(model.sectionTitles[si] ?? s.title, LIMIT.groupTitle, `instructions.sections.${si}`)),
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
