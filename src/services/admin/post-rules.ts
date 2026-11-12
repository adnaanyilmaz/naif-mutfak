// Pure editor rules shared by the Server Action (authoritative) and the editor UI (inline hints).
import { mediaUrl } from '@/services/media/image-url';
import { buildRecipeJsonLd } from '@/services/seo/recipe-jsonld';
import type { Ingredients, Instructions, Locale } from '@/validators/content';
import { recipeJsonLdRequiredSchema } from '@/validators/recipe-jsonld';

export type AdminIssueCode =
  | 'invalid'
  | 'publish_dek'
  | 'publish_body'
  | 'publish_ingredients'
  | 'publish_instructions'
  | 'publish_servings'
  | 'publish_hero'
  | 'publish_jsonld'
  | 'status_needs_locale'
  | 'slug_taken';

export interface AdminIssue {
  /** Dotted path, e.g. `translations.en.dek` or `post.status`. */
  path: string;
  code: AdminIssueCode;
}

export interface RuleShared {
  isRecipe: boolean;
  baseServings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  category: string;
}

export interface RuleTranslation {
  locale: Locale;
  title: string;
  slug: string;
  dek: string | null;
  bodyMd: string;
  ingredients: Ingredients | null;
  instructions: Instructions | null;
  keywords: string[];
  cuisine: string | null;
}

export interface RuleContext {
  heroImageKey: string | null;
  mediaBaseUrl: string;
  siteUrl: string;
}

/** Fields a locale needs before it can be published (ignores the `isPublished` flag itself). */
export function publishIssues(shared: RuleShared, t: RuleTranslation, ctx: RuleContext): AdminIssue[] {
  const at = (field: string) => `translations.${t.locale}.${field}`;
  const issues: AdminIssue[] = [];
  if (!t.dek?.trim()) issues.push({ path: at('dek'), code: 'publish_dek' });
  if (!shared.isRecipe && !t.bodyMd.trim()) issues.push({ path: at('bodyMd'), code: 'publish_body' });
  if (!shared.isRecipe) return issues;

  const ingredients = t.ingredients ?? [];
  const instructions = t.instructions ?? [];
  if (ingredients.length === 0) issues.push({ path: at('ingredients'), code: 'publish_ingredients' });
  if (instructions.length === 0) issues.push({ path: at('instructions'), code: 'publish_instructions' });
  if (shared.baseServings === null) issues.push({ path: 'post.baseServings', code: 'publish_servings' });
  if (!ctx.heroImageKey) issues.push({ path: 'post.heroImage', code: 'publish_hero' });
  if (issues.length > 0) return issues;

  // Dry-run the public JSON-LD with the draft data (Google rich-result required fields).
  const jsonLd = buildRecipeJsonLd({
    title: t.title,
    description: t.dek,
    locale: t.locale,
    canonicalUrl: `${ctx.siteUrl.replace(/\/+$/, '')}/${t.locale}/blog/${t.slug}`,
    imageUrls: ctx.heroImageKey ? [mediaUrl(ctx.mediaBaseUrl, ctx.heroImageKey, 1600)] : [],
    publishedAt: null,
    updatedAt: null,
    authorName: 'Naif Mutfak',
    prepMinutes: shared.prepMinutes,
    cookMinutes: shared.cookMinutes,
    restMinutes: shared.restMinutes,
    baseServings: shared.baseServings,
    yieldLabel: null,
    categoryLabel: shared.category,
    cuisine: t.cuisine,
    keywords: t.keywords,
    ingredients,
    instructions,
    imageUrl: (key) => mediaUrl(ctx.mediaBaseUrl, key, 1080),
  });
  if (!recipeJsonLdRequiredSchema.safeParse(jsonLd).success) issues.push({ path: at('jsonLd'), code: 'publish_jsonld' });
  return issues;
}

export type Completeness = 'complete' | 'partial' | 'empty';

/** Locale tab dot: ● complete, ◐ missing required fields, ○ not started. */
export function translationCompleteness(shared: RuleShared, t: RuleTranslation | undefined, ctx: RuleContext): Completeness {
  if (!t || (!t.title.trim() && !t.bodyMd.trim())) return 'empty';
  if (!t.title.trim() || !t.slug) return 'partial';
  return publishIssues(shared, t, ctx).length === 0 ? 'complete' : 'partial';
}

export type StructureWarningKind = 'ingredient_ids' | 'ingredient_quantity' | 'step_ids';

export interface StructureWarning {
  locale: Locale;
  kind: StructureWarningKind;
  /** Ingredient id for quantity mismatches. */
  id?: string;
}

interface StructureSource {
  locale: Locale;
  ingredients: Ingredients | null;
  instructions: Instructions | null;
}

/** Ingredient ids/quantities and step ids must match the reference (TR, else first) locale. */
export function diffStructure(translations: readonly StructureSource[]): StructureWarning[] {
  const reference = translations.find((t) => t.locale === 'tr') ?? translations[0];
  if (!reference) return [];
  const refItems = (reference.ingredients ?? []).flatMap((g) => g.items);
  const refIds = refItems.map((i) => i.id).join('|');
  const refSteps = (reference.instructions ?? []).flatMap((s) => s.steps.map((st) => st.id)).join('|');
  const warnings: StructureWarning[] = [];

  for (const t of translations) {
    if (t === reference) continue;
    const items = (t.ingredients ?? []).flatMap((g) => g.items);
    if (items.length > 0 && items.map((i) => i.id).join('|') !== refIds) {
      warnings.push({ locale: t.locale, kind: 'ingredient_ids' });
    }
    for (const item of items) {
      const ref = refItems.find((r) => r.id === item.id);
      if (ref && (ref.quantity !== item.quantity || ref.quantityMax !== item.quantityMax || ref.unitGrams !== item.unitGrams)) {
        warnings.push({ locale: t.locale, kind: 'ingredient_quantity', id: item.id });
      }
    }
    const steps = (t.instructions ?? []).flatMap((s) => s.steps.map((st) => st.id)).join('|');
    if (steps && steps !== refSteps) warnings.push({ locale: t.locale, kind: 'step_ids' });
  }
  return warnings;
}
