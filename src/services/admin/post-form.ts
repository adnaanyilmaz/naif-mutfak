// Pure converters between stored posts and the editor form model. Shared by the editor UI and tests.
import type { AdminPostRecord, AdminTranslation } from '@/repositories/admin-posts';
import { DEFAULT_CATEGORY, findCategory } from '@/services/content/category';
import { slugify } from '@/services/content/slug';
import type { Ingredients, Instructions, Locale } from '@/validators/content';
import type {
  IngredientGroupForm,
  PostForm,
  SectionForm,
  SharedForm,
  StepForm,
  TranslationForm,
} from '@/validators/admin/post-form';
import type { PostSharedInput, PostTranslationInput } from '@/validators/admin/post';
import type { RuleShared, RuleTranslation } from './post-rules';

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** '' → null; '1,5' → 1.5; garbage → NaN (rejected by Zod with a path). */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  return t === '' ? null : Number(t.replace(',', '.'));
}

function optionalNumber(s: string): number | undefined {
  const n = parseNumber(s);
  return n === null ? undefined : n;
}

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function emptyIngredientRow(): IngredientGroupForm['items'][number] {
  return { id: newId(), quantity: '', quantityMax: '', unit: '', unitGrams: '', name: '', note: '', scalable: true };
}

export function emptyStep(): StepForm {
  return { id: newId(), text: '', imageKey: null, timerMinutes: '' };
}

export function emptyTranslation(locale: Locale): TranslationForm {
  return {
    locale,
    title: '',
    slug: '',
    dek: '',
    bodyMd: '',
    heroImageAlt: '',
    seoTitle: '',
    seoDescription: '',
    keywords: '',
    cuisine: '',
    isPublished: false,
    ingredients: [],
    instructions: [],
  };
}

function ingredientsToForm(groups: Ingredients | null): IngredientGroupForm[] {
  return (groups ?? []).map((g) => ({
    key: newId(),
    title: g.title ?? '',
    items: g.items.map((i) => ({
      id: i.id,
      quantity: str(i.quantity),
      quantityMax: str(i.quantityMax),
      unit: i.unit ?? '',
      unitGrams: str(i.unitGrams),
      name: i.name,
      note: i.note ?? '',
      scalable: i.scalable,
    })),
  }));
}

function instructionsToForm(sections: Instructions | null): SectionForm[] {
  return (sections ?? []).map((s) => ({
    key: newId(),
    title: s.title ?? '',
    steps: s.steps.map((st) => ({
      id: st.id,
      text: st.text,
      imageKey: st.imageKey ?? null,
      timerMinutes: st.timerSeconds ? str(Math.round(st.timerSeconds / 60)) : '',
    })),
  }));
}

function translationToForm(t: AdminTranslation): TranslationForm {
  return {
    locale: t.locale,
    title: t.title,
    slug: t.slug,
    dek: t.dek ?? '',
    bodyMd: t.bodyMd,
    heroImageAlt: t.heroImageAlt ?? '',
    seoTitle: t.seoTitle ?? '',
    seoDescription: t.seoDescription ?? '',
    keywords: t.keywords.join(', '),
    cuisine: t.cuisine ?? '',
    isPublished: t.isPublished,
    ingredients: ingredientsToForm(t.ingredients),
    instructions: instructionsToForm(t.instructions),
  };
}

export function toPostForm(post: AdminPostRecord): PostForm {
  const find = (l: Locale) => {
    const t = post.translations.find((x) => x.locale === l);
    return t ? translationToForm(t) : null;
  };
  return {
    shared: {
      status: post.status,
      category: findCategory(post.category) ?? DEFAULT_CATEGORY,
      isRecipe: post.isRecipe,
      prepMinutes: str(post.prepMinutes),
      cookMinutes: str(post.cookMinutes),
      restMinutes: str(post.restMinutes),
      baseServings: str(post.baseServings),
      difficulty: post.difficulty ?? '',
      featuredProductId: post.featuredProductId ?? '',
    },
    translations: { tr: find('tr'), en: find('en'), ar: find('ar') },
  };
}

export function sharedFromForm(s: SharedForm): PostSharedInput {
  return {
    status: s.status,
    category: s.category,
    isRecipe: s.isRecipe,
    prepMinutes: parseNumber(s.prepMinutes),
    cookMinutes: parseNumber(s.cookMinutes),
    restMinutes: parseNumber(s.restMinutes),
    baseServings: parseNumber(s.baseServings),
    difficulty: s.difficulty === '' ? null : s.difficulty,
    featuredProductId: s.featuredProductId === '' ? null : s.featuredProductId,
  };
}

function ingredientsFromForm(groups: IngredientGroupForm[]): Ingredients {
  return groups.map((g) => ({
    ...(g.title.trim() ? { title: g.title.trim() } : {}),
    items: g.items.map((i) => {
      const quantityMax = optionalNumber(i.quantityMax);
      const unitGrams = optionalNumber(i.unitGrams);
      return {
        id: i.id,
        quantity: parseNumber(i.quantity),
        ...(quantityMax !== undefined ? { quantityMax } : {}),
        ...(i.unit.trim() ? { unit: i.unit.trim() } : {}),
        ...(unitGrams !== undefined ? { unitGrams } : {}),
        name: i.name.trim(),
        ...(i.note.trim() ? { note: i.note.trim() } : {}),
        scalable: i.scalable,
      };
    }),
  }));
}

function instructionsFromForm(sections: SectionForm[]): Instructions {
  return sections.map((s) => ({
    ...(s.title.trim() ? { title: s.title.trim() } : {}),
    steps: s.steps.map((st) => {
      const minutes = optionalNumber(st.timerMinutes);
      return {
        id: st.id,
        text: st.text.trim(),
        ...(st.imageKey ? { imageKey: st.imageKey } : {}),
        ...(minutes !== undefined ? { timerSeconds: Math.round(minutes * 60) } : {}),
      };
    }),
  }));
}

export function translationFromForm(t: TranslationForm, isRecipe: boolean): PostTranslationInput {
  const ingredients = ingredientsFromForm(t.ingredients);
  const instructions = instructionsFromForm(t.instructions);
  return {
    locale: t.locale,
    title: t.title,
    slug: t.slug,
    dek: t.dek,
    bodyMd: t.bodyMd,
    heroImageAlt: t.heroImageAlt,
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    ingredients: isRecipe && ingredients.length > 0 ? ingredients : null,
    instructions: isRecipe && instructions.length > 0 ? instructions : null,
    keywords: t.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    cuisine: t.cuisine,
    isPublished: t.isPublished,
  };
}

/** Locales with a started translation (title or body), in canonical order. */
export function startedTranslations(form: PostForm): TranslationForm[] {
  return [form.translations.tr, form.translations.en, form.translations.ar].filter(
    (t): t is TranslationForm => t !== null && (t.title.trim() !== '' || t.bodyMd.trim() !== ''),
  );
}

/** Raw payload for the Server Action (re-validated there with savePostInputSchema). */
export function toSaveInput(form: PostForm, postId: string, expectedUpdatedAt: number) {
  return {
    postId,
    expectedUpdatedAt,
    post: sharedFromForm(form.shared),
    translations: startedTranslations(form).map((t) => translationFromForm(t, form.shared.isRecipe)),
  };
}

/** Rule inputs for live completeness dots (numbers may be NaN while typing; rules still run). */
export function ruleInputs(form: PostForm, t: TranslationForm): { shared: RuleShared; translation: RuleTranslation } {
  const shared = sharedFromForm(form.shared);
  const tr = translationFromForm(t, form.shared.isRecipe);
  return {
    shared,
    translation: {
      locale: tr.locale,
      title: tr.title,
      slug: tr.slug,
      dek: tr.dek === '' ? null : tr.dek,
      bodyMd: tr.bodyMd,
      ingredients: tr.ingredients,
      instructions: tr.instructions,
      keywords: tr.keywords,
      cuisine: tr.cuisine === '' ? null : tr.cuisine,
    },
  };
}

/** "Copy structure from TR": same groups/ids/quantities/units; names, notes and step texts blank. */
export function copyStructure(source: TranslationForm, target: TranslationForm): TranslationForm {
  return {
    ...target,
    ingredients: source.ingredients.map((g) => ({
      key: newId(),
      title: '',
      items: g.items.map((i) => ({ ...i, name: '', note: '' })),
    })),
    instructions: source.instructions.map((s) => ({
      key: newId(),
      title: '',
      steps: s.steps.map((st) => ({ ...st, text: '' })),
    })),
  };
}

export function autoSlug(title: string, locale: Locale): string {
  return slugify(title, locale);
}

/** Maps a Zod path `translations.N.field` (array index as sent) to the locale it belongs to. */
export function issueLocale(path: string, sent: readonly Locale[]): Locale | null {
  const m = /^translations\.(\w+)/.exec(path);
  if (!m?.[1]) return null;
  const seg = m[1];
  if (seg === 'tr' || seg === 'en' || seg === 'ar') return seg;
  const idx = Number(seg);
  return Number.isInteger(idx) ? (sent[idx] ?? null) : null;
}
