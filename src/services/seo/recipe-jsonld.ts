import { formatIngredient, ingredientLineText } from '@/services/recipe/scale';
import type { Ingredients, Instructions, Locale } from '@/validators/content';
import { toIsoDuration } from './jsonld';

export interface RecipeJsonLdInput {
  title: string;
  description: string | null;
  locale: Locale;
  canonicalUrl: string;
  imageUrls: string[];
  publishedAt: Date | null;
  updatedAt: Date | null;
  authorName: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  baseServings: number | null;
  /** Localized yield text, e.g. "12 servings". */
  yieldLabel: string | null;
  categoryLabel: string | null;
  cuisine: string | null;
  keywords: string[] | null;
  ingredients: Ingredients;
  instructions: Instructions;
  /** Resolves an instruction step image key to an absolute URL. */
  imageUrl: (key: string) => string;
  rating?: { value: number; count: number } | undefined;
}

interface HowToStep {
  '@type': 'HowToStep';
  text: string;
  url: string;
  image?: string;
}

interface HowToSection {
  '@type': 'HowToSection';
  name: string;
  itemListElement: HowToStep[];
}

export interface RecipeJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Recipe';
  name: string;
  description?: string;
  image?: string[];
  author: { '@type': 'Person'; name: string };
  datePublished?: string;
  dateModified?: string;
  inLanguage: Locale;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string[];
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string;
  recipeIngredient: string[];
  recipeInstructions: HowToStep[] | HowToSection[];
  aggregateRating?: { '@type': 'AggregateRating'; ratingValue: number; ratingCount: number };
}

/** Step anchors shared with the Recipe Card (`id="step-N"`, 1-based across sections). */
export function stepAnchor(index: number): string {
  return `step-${index + 1}`;
}

/** Built from base (1×) quantities. */
export function buildRecipeJsonLd(input: RecipeJsonLdInput): RecipeJsonLd {
  let n = 0;
  const toStep = (s: Instructions[number]['steps'][number]): HowToStep => {
    const step: HowToStep = { '@type': 'HowToStep', text: s.text, url: `${input.canonicalUrl}#${stepAnchor(n++)}` };
    if (s.imageKey) step.image = input.imageUrl(s.imageKey);
    return step;
  };

  const allTitled = input.instructions.length > 0 && input.instructions.every((s) => s.title);
  const recipeInstructions: HowToStep[] | HowToSection[] = allTitled
    ? input.instructions.map((s) => ({ '@type': 'HowToSection', name: s.title ?? '', itemListElement: s.steps.map(toStep) }))
    : input.instructions.flatMap((s) => s.steps.map(toStep));

  const out: RecipeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: input.title,
    author: { '@type': 'Person', name: input.authorName },
    inLanguage: input.locale,
    recipeIngredient: input.ingredients.flatMap((g) =>
      g.items.map((i) => ingredientLineText(formatIngredient(i, 1, input.locale))),
    ),
    recipeInstructions,
  };

  if (input.description) out.description = input.description;
  if (input.imageUrls.length > 0) out.image = input.imageUrls;
  if (input.publishedAt) out.datePublished = input.publishedAt.toISOString();
  if (input.updatedAt) out.dateModified = input.updatedAt.toISOString();
  if (input.prepMinutes !== null) out.prepTime = toIsoDuration(input.prepMinutes);
  if (input.cookMinutes !== null) out.cookTime = toIsoDuration(input.cookMinutes);
  const parts = [input.prepMinutes, input.cookMinutes, input.restMinutes].filter((v): v is number => v !== null);
  if (parts.length > 0) out.totalTime = toIsoDuration(parts.reduce((a, b) => a + b, 0));
  if (input.baseServings !== null) {
    out.recipeYield = input.yieldLabel ? [String(input.baseServings), input.yieldLabel] : [String(input.baseServings)];
  }
  if (input.categoryLabel) out.recipeCategory = input.categoryLabel;
  if (input.cuisine) out.recipeCuisine = input.cuisine;
  if (input.keywords && input.keywords.length > 0) out.keywords = input.keywords.join(', ');
  if (input.rating && input.rating.count > 0) {
    out.aggregateRating = { '@type': 'AggregateRating', ratingValue: input.rating.value, ratingCount: input.rating.count };
  }
  return out;
}
