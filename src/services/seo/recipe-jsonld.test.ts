import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ingredientsSchema, instructionsSchema } from '@/validators/content';
import { serializeJsonLd, toIsoDuration } from './jsonld';
import { buildRecipeJsonLd, type RecipeJsonLdInput } from './recipe-jsonld';

/** Mirrors Google's Recipe rich-result required (name, image) + recommended fields. */
const isoDuration = z.string().regex(/^PT(?:\d+H)?(?:\d+M)?$/);
const howToStep = z.object({ '@type': z.literal('HowToStep'), text: z.string().min(1), url: z.url(), image: z.url().optional() });
const googleRecipeSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('Recipe'),
  name: z.string().min(1),
  image: z.array(z.url()).min(1),
  description: z.string().min(1),
  author: z.object({ '@type': z.enum(['Person', 'Organization']), name: z.string().min(1) }),
  datePublished: z.iso.datetime(),
  prepTime: isoDuration,
  cookTime: isoDuration,
  totalTime: isoDuration,
  recipeYield: z.array(z.string()).min(1),
  recipeCategory: z.string(),
  recipeCuisine: z.string(),
  keywords: z.string(),
  recipeIngredient: z.array(z.string().min(1)).min(1),
  recipeInstructions: z.union([
    z.array(howToStep).min(1),
    z.array(z.object({ '@type': z.literal('HowToSection'), name: z.string().min(1), itemListElement: z.array(howToStep).min(1) })).min(1),
  ]),
  aggregateRating: z.object({ '@type': z.literal('AggregateRating'), ratingValue: z.number(), ratingCount: z.number().int().positive() }).optional(),
});

const ingredients = ingredientsSchema.parse([
  {
    title: 'For the dough',
    items: [
      { id: 'flour', quantity: 500, unit: 'g', name: 'bread flour' },
      { id: 'salt', quantity: 1.5, unit: 'tsp', name: 'salt', note: 'fine' },
      { id: 'oil', quantity: null, name: 'olive oil, to taste', scalable: false },
    ],
  },
]);

const instructions = instructionsSchema.parse([
  { title: 'Dough', steps: [{ id: 'a', text: 'Whisk the flour.', imageKey: 'posts/p1/a.jpg' }, { id: 'b', text: 'Knead.' }] },
  { title: 'Bake', steps: [{ id: 'c', text: 'Bake 35 minutes.' }] },
]);

const base: RecipeJsonLdInput = {
  title: 'Sourdough Country Loaf',
  description: 'A crackling crust.',
  locale: 'en',
  canonicalUrl: 'https://naifmutfak.com/en/blog/sourdough-country-loaf',
  imageUrls: ['https://media.naifmutfak.com/cdn-cgi/image/width=1600,format=auto/posts/p1/hero.jpg'],
  publishedAt: new Date('2026-10-18T08:00:00Z'),
  updatedAt: new Date('2026-10-19T08:00:00Z'),
  authorName: 'Naif Mutfak',
  prepMinutes: 20,
  cookMinutes: 35,
  restMinutes: 60,
  baseServings: 8,
  yieldLabel: '8 servings',
  categoryLabel: 'Bread',
  cuisine: 'European',
  keywords: ['sourdough', 'bread'],
  ingredients,
  instructions,
  imageUrl: (key) => `https://media.naifmutfak.com/${key}`,
};

describe('buildRecipeJsonLd', () => {
  it('satisfies the Google Recipe schema', () => {
    const ld = buildRecipeJsonLd(base);
    expect(googleRecipeSchema.safeParse(ld).success).toBe(true);
  });

  it('computes ISO 8601 durations including rest time in totalTime', () => {
    const ld = buildRecipeJsonLd(base);
    expect(ld.prepTime).toBe('PT20M');
    expect(ld.cookTime).toBe('PT35M');
    expect(ld.totalTime).toBe('PT1H55M');
    expect(ld.recipeYield).toEqual(['8', '8 servings']);
  });

  it('uses base (1×) quantities for recipeIngredient', () => {
    expect(buildRecipeJsonLd(base).recipeIngredient).toEqual(['500 g bread flour', '1½ tsp salt (fine)', 'olive oil, to taste']);
  });

  it('emits HowToSection with step anchors that match the Recipe Card', () => {
    const ld = buildRecipeJsonLd(base);
    expect(ld.recipeInstructions).toEqual([
      {
        '@type': 'HowToSection',
        name: 'Dough',
        itemListElement: [
          { '@type': 'HowToStep', text: 'Whisk the flour.', url: `${base.canonicalUrl}#step-1`, image: 'https://media.naifmutfak.com/posts/p1/a.jpg' },
          { '@type': 'HowToStep', text: 'Knead.', url: `${base.canonicalUrl}#step-2` },
        ],
      },
      { '@type': 'HowToSection', name: 'Bake', itemListElement: [{ '@type': 'HowToStep', text: 'Bake 35 minutes.', url: `${base.canonicalUrl}#step-3` }] },
    ]);
  });

  it('emits a flat HowToStep list when sections have no titles', () => {
    const flat = instructionsSchema.parse([{ steps: [{ id: 'a', text: 'One.' }] }, { steps: [{ id: 'b', text: 'Two.' }] }]);
    const ld = buildRecipeJsonLd({ ...base, instructions: flat });
    expect(ld.recipeInstructions).toEqual([
      { '@type': 'HowToStep', text: 'One.', url: `${base.canonicalUrl}#step-1` },
      { '@type': 'HowToStep', text: 'Two.', url: `${base.canonicalUrl}#step-2` },
    ]);
  });

  it('omits aggregateRating without real ratings and includes it with them', () => {
    expect(buildRecipeJsonLd(base).aggregateRating).toBeUndefined();
    expect(buildRecipeJsonLd({ ...base, rating: { value: 4.9, count: 0 } }).aggregateRating).toBeUndefined();
    expect(buildRecipeJsonLd({ ...base, rating: { value: 4.9, count: 128 } }).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.9,
      ratingCount: 128,
    });
  });

  it('omits optional fields that are missing', () => {
    const ld = buildRecipeJsonLd({ ...base, imageUrls: [], description: null, keywords: null, cuisine: null, restMinutes: null });
    expect(ld).not.toHaveProperty('image');
    expect(ld).not.toHaveProperty('description');
    expect(ld).not.toHaveProperty('keywords');
    expect(ld.totalTime).toBe('PT55M');
  });

  it('formats Arabic ingredient amounts with Arabic digits', () => {
    const ld = buildRecipeJsonLd({ ...base, locale: 'ar' });
    expect(ld.inLanguage).toBe('ar');
    expect(ld.recipeIngredient[0]).toMatch(/^٥٠٠ g/);
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so content cannot close the script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c/script>');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' });
  });

  it('escapes U+2028/U+2029', () => {
    const out = serializeJsonLd({ t: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}` });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });
});

describe('toIsoDuration', () => {
  it.each([
    [0, 'PT0M'],
    [45, 'PT45M'],
    [60, 'PT1H'],
    [115, 'PT1H55M'],
    [840, 'PT14H'],
  ])('%i min → %s', (min, iso) => {
    expect(toIsoDuration(min)).toBe(iso);
  });
});
