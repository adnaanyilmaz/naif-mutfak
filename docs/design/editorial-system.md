# Editorial Design System

Direction: warm, quiet, magazine-like. Generous whitespace, large serif headlines, photography-led layouts, restrained color. Inspired by the *feel* of high-end baking editorials (e.g. natashasbaking.com) — no copied assets, layouts, or copy.

Implementation: Tailwind CSS v4 `@theme` tokens in `src/app/globals.css`. Components use tokens only — no raw hex values or arbitrary pixel values in JSX.

## 1. Color Tokens

| Token | Hex | Use | Contrast on `cream` |
|---|---|---|---|
| `--color-cream` | `#FAF8F5` | Page background | — |
| `--color-paper` | `#FFFFFF` | Cards, recipe card surface | — |
| `--color-linen` | `#F2EDE6` | Section bands, callout background, input fill | — |
| `--color-charcoal` | `#1C1917` | Body text, headings | 16.9 : 1 |
| `--color-stone` | `#57534E` | Secondary text, meta, captions | 7.4 : 1 |
| `--color-muted` | `#8A847C` | Disabled, placeholders (non-essential text only) | 3.6 : 1 |
| `--color-hairline` | `#E7E1D8` | Dividers, card borders | — |
| `--color-terracotta` | `#A4492F` | Primary accent: links, CTAs, active states | 5.5 : 1 |
| `--color-terracotta-deep` | `#863A25` | CTA hover/pressed | 7.4 : 1 |
| `--color-terracotta-tint` | `#F4E4DC` | Selected chips, highlight wash | — |
| `--color-olive` | `#5F6B3A` | Secondary accent: tags, checkmarks, "e-book" eyebrow | 5.4 : 1 |
| `--color-olive-tint` | `#E8EADB` | Checked ingredient wash, success bg | — |
| `--color-butter` | `#E9C46A` | Rating stars, sparing decorative use (never text) | — |
| `--color-danger` | `#9B2C2C` | Form errors | 7.0 : 1 |

Rules: text ≥ 4.5:1 (WCAG AA). Accent covers < 10% of any viewport. Light theme only for v1; tokens are named semantically so a dark theme can be added later.

```css
@import 'tailwindcss';

@theme {
  --color-cream: #FAF8F5;  --color-paper: #FFFFFF;  --color-linen: #F2EDE6;
  --color-charcoal: #1C1917; --color-stone: #57534E; --color-muted: #8A847C; --color-hairline: #E7E1D8;
  --color-terracotta: #A4492F; --color-terracotta-deep: #863A25; --color-terracotta-tint: #F4E4DC;
  --color-olive: #5F6B3A; --color-olive-tint: #E8EADB; --color-butter: #E9C46A; --color-danger: #9B2C2C;

  --font-display: var(--font-playfair), 'Times New Roman', serif;
  --font-serif: var(--font-cormorant), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-display-ar: var(--font-amiri), 'Times New Roman', serif;
  --font-sans-ar: var(--font-plex-ar), system-ui, sans-serif;

  --radius-card: 0.25rem;   /* editorial: nearly square */
  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgb(28 25 23 / 0.04), 0 8px 24px -12px rgb(28 25 23 / 0.12);
  --ease-editorial: cubic-bezier(0.2, 0.7, 0.2, 1);
}
```

## 2. Typography

Loaded with `next/font/google` (self-hosted at build, `display: 'swap'`), exposed as CSS variables on `<html>`.

| Role | TR / EN | AR | Notes |
|---|---|---|---|
| Display / H1–H2 | Playfair Display 600 (`latin`, `latin-ext` for ç ğ ı İ ö ş ü) | Amiri 700 | Tight leading, optical size via `font-optical-sizing: auto` |
| H3–H4, dek, pull quotes | Cormorant Garamond 500/600 + italic | Amiri 400 / italic → regular (no Arabic italic) | Dek = standfirst under the headline |
| Body (long-form) | Cormorant Garamond 500 @ 20–21px | IBM Plex Sans Arabic 400 @ 18px | Cormorant is legible only at ≥ 19px; never use it below |
| UI, recipe card data, buttons, forms | Inter 400/500/600 | IBM Plex Sans Arabic 400/500/600 | Inter is a UI addition; tabular numerals (`tabular-nums`) for quantities and prices |

Locale switch: `<html lang={locale} dir={dir} data-script={locale === 'ar' ? 'arabic' : 'latin'}>`; base styles map `font-display`/`font-serif`/`font-sans` to the Arabic families when `[data-script=arabic]`. Arabic: `letter-spacing: 0` always (no tracking on connected scripts), line-height +10%.

Type scale (fluid, `clamp`):

| Token | Size | Line height | Tracking |
|---|---|---|---|
| `display` | clamp(2.75rem, 2rem + 3.5vw, 4.75rem) | 1.05 | -0.02em |
| `h1` | clamp(2.25rem, 1.8rem + 2vw, 3.5rem) | 1.1 | -0.015em |
| `h2` | clamp(1.75rem, 1.5rem + 1.2vw, 2.5rem) | 1.15 | -0.01em |
| `h3` | 1.5rem | 1.25 | 0 |
| `dek` | 1.375rem italic | 1.45 | 0 |
| `body` | 1.25rem | 1.7 | 0 |
| `ui` | 0.9375rem | 1.5 | 0 |
| `eyebrow` | 0.75rem, Inter 600, uppercase (Latin only) | 1.2 | 0.14em |

Measure: article body max `68ch`; recipe card `min(100%, 46rem)`.

## 3. Layout & Spacing

- Spacing scale: Tailwind default (4px base). Section rhythm: `py-16 md:py-24`. Paragraph spacing: `mt-[1.1em]`.
- Containers: `content` 720px (article), `wide` 1080px (galleries, recipe card), `full` 1360px (home grids).
- Grid: home uses a 12-col editorial grid; hero story spans 7 cols + stacked secondary stories in 5.
- Images: `aspect-[4/5]` for recipe heroes, `aspect-[3/2]` for in-article, `aspect-square` for grid tiles. Served from `MEDIA_PUBLIC` through Cloudflare Image Transformations (`format=auto`, widths 480/768/1080/1600) via a custom `next/image` loader.
- Motion: 200–300ms with `--ease-editorial`; respect `prefers-reduced-motion`.
- **RTL:** all spacing/position via logical utilities (`ms/me/ps/pe/start/end/text-start`). Images and grids mirror automatically; directional icons use `rtl:-scale-x-100`.

## 4. Component: Recipe Card

Location: `src/components/recipe/RecipeCard.tsx` (server) + `RecipeCardInteractive.tsx` (client island). Data source: `post_translations.ingredients_json` / `instructions_json` + `posts` time/servings fields. Anchor: `#recipe` ("Jump to recipe" button at article top, `scroll-margin-top` for sticky header).

### Anatomy

```
┌───────────────────────────────────────────────────────────┐
│ [eyebrow: RECIPE]                         [Print] [Pin/Save]│
│ Title (h2, display font)                                    │
│ ★★★★★ 4.9 (128)                                             │
│ ┌─────────┬─────────┬─────────┬──────────┬──────────────┐  │
│ │ Prep 20m│ Cook 35m│ Rest 1h │ Total 1h55│ Serves [−]8[+]│  │
│ └─────────┴─────────┴─────────┴──────────┴──────────────┘  │
│ Servings: [½×] [1×] [2×] [3×]        Units: [Cups | Grams] │
│ ── Ingredients ─────────────────────────────────────────── │
│  For the dough                                              │
│  ☐ 500 g  bread flour                                       │
│  ☑ 1½ tsp salt  (room temperature)      ← struck, olive    │
│ ── Instructions ────────────────────────────────────────── │
│  1  Whisk the flour…                     [⏱ 10:00]         │
│ ── Notes ───────────────────────────────────────────────── │
│ [E-book callout, compact variant — optional]               │
└───────────────────────────────────────────────────────────┘
```

### Behavior

| Feature | Spec |
|---|---|
| Servings multiplier | Presets `0.5× 1× 2× 3×` + stepper (1–48). `factor = servings / baseServings`. Only items with `scalable: true` scale; `quantity: null` renders name only. Ranges scale both ends. |
| Quantity formatting | `src/services/recipe/format-quantity.ts` (pure, unit-tested). Rounds to nearest common fraction (⅛ ¼ ⅓ ½ ⅔ ¾) for volume units; grams round to 1 g (< 100 g) or 5 g. TR/EN: Unicode fractions. AR: `Intl.NumberFormat('ar', { maximumFractionDigits: 2 })` with decimals (fractions read poorly in RTL). |
| Unit toggle | Shown only if every scalable item has `unitGrams`. Preference stored in `localStorage` (`nm:units`). |
| Ingredient checkboxes | Native `<input type="checkbox">` inside `<label>` (whole row clickable, 44px min target). Checked → `line-through text-stone bg-olive-tint`. State persisted in `localStorage` key `nm:recipe:{postId}:{locale}` (ingredient `id`s), cleared via "Reset" link. |
| Step tracking | Clicking a step marks it done (same persistence). Optional per-step timer when `timerSeconds` set (client only, `aria-live="polite"` announcement). |
| Cook mode | Toggle requests Screen Wake Lock API; hidden if unsupported. |
| Print view | `/[locale]/recipes/[slug]/print` route + `@media print` stylesheet: only the card; black on white; no images except optional small hero; QR/short URL in footer; current multiplier and unit choice passed via query (`?s=16&u=g`). `window.print()` from the Print button. Page breaks avoided inside groups (`break-inside: avoid`). |
| Accessibility | Card is `<section aria-labelledby>`; meta as `<dl>`; ingredients `<ul>` per group with `<h4>`; instructions `<ol>`; multiplier changes announced via `aria-live`. |
| RTL | Checkbox column on `start`, timer on `end`; step numbers use locale digits. |

### JSON-LD (`src/services/seo/recipe-jsonld.ts`)

Generated server-side from the **base** (1×) data, rendered once per page in `<script type="application/ld+json">` with `<` escaped to `<`.

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "<title>",
  "description": "<dek>",
  "image": ["<1600w url>", "<1080w 4:3 url>", "<1080w 1:1 url>"],
  "author": { "@type": "Person", "name": "Naif Mutfak" },
  "datePublished": "<ISO 8601>",
  "inLanguage": "<tr|en|ar>",
  "prepTime": "PT20M", "cookTime": "PT35M", "totalTime": "PT1H55M",
  "recipeYield": ["8", "8 servings"],
  "recipeCategory": "<category label>",
  "recipeCuisine": "<cuisine>",
  "keywords": "<comma-joined keywordsJson>",
  "recipeIngredient": ["500 g bread flour", "1½ tsp salt"],
  "recipeInstructions": [
    { "@type": "HowToSection", "name": "For the dough",
      "itemListElement": [{ "@type": "HowToStep", "text": "Whisk the flour…", "url": "<canonical>#step-1", "image": "<url>" }] }
  ],
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": 4.9, "ratingCount": 128 }
}
```

`aggregateRating` emitted only when real ratings exist. Sections without titles emit flat `HowToStep` arrays. Validated in tests against a Zod schema mirroring Google's required/recommended fields.

## 5. Component: In-Article E-book Callout

Authored in `body_md` with a directive (rendered via unified/remark → hast → React; **no runtime MDX eval** — Workers forbids `eval`/`new Function`):

```md
::ebook{product="sourdough-basics" variant="compact"}
```

Component: `src/components/commerce/EbookCallout.tsx` (server) + `BuyButton.tsx` (client). Data via `services/catalog` (product + translation + variant for the reader's locale; falls back to TR content variant with a "Turkish edition" badge if no variant exists in that language).

```
┌──────────────────────────────────────────────────────────┐ bg-linen, border-s-4 border-terracotta
│ ┌────────┐  E-BOOK  (eyebrow, olive)                       │
│ │ cover  │  Sourdough Basics (h3, display)                 │
│ │ 3:4    │  Subtitle in Cormorant italic                   │
│ │ shadow │  • 42 recipes · 180 pages · PDF                  │
│ └────────┘  ₺349,00   [ Buy the e-book → ]  Preview ↗      │
└──────────────────────────────────────────────────────────┘
```

| Aspect | Spec |
|---|---|
| Variants | `full` (default, after 2nd–3rd section) · `compact` (inside recipe card notes, cover 64px) · `inline` (single text line + link) |
| Price | `Intl.NumberFormat(locale, { style: 'currency', currency })` with `tr→TRY`, `en→USD`, `ar→SAR`. Note under price: "Final price & tax shown at checkout" (MoR may localize). |
| CTA | Terracotta solid button, 48px height, opens MoR overlay via `POST /api/checkout` (payments.md). Loading state with spinner; error inline in `text-danger`. Arrow icon `rtl:-scale-x-100`. |
| Placement rules | Max one `full` callout per article; never above the fold; never inside the ingredient list. |
| Analytics | `data-ebook-callout={productSlug}` + `data-placement`; subscriber/checkout `source='ebook_callout'`. |
| Accessibility | `<aside aria-label>`; cover `alt` from `product_translations.cover_alt`; button text includes product title for screen readers. |

## 6. Other Core Components (tokens summary)

- **Header:** cream, hairline bottom border, centered wordmark (display font), locale switcher (`TR · EN · عربي`) at `end`.
- **Story card:** image → eyebrow (category, olive) → title (display, h3) → dek (serif italic, stone). No card borders; hover underlines title in terracotta.
- **Newsletter band:** `bg-linen`, serif headline, single email field + button, consent microcopy; posts to subscribers service with `source`.
- **Buttons:** primary terracotta / secondary outline charcoal / text link terracotta with 1px underline offset 4px. Radius `--radius-card`. Focus ring: 2px charcoal outline, 2px offset.
