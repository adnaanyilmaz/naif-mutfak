# Editorial Design System

Direction: **modern minimal**. White canvas, bold geometric sans headlines, large rounded image cards, pill-shaped controls and a single warm orange accent. Content and photography lead; chrome stays quiet. No copied assets, layouts or copy from other sites.

Implementation: Tailwind CSS v4 `@theme` tokens in `src/app/globals.css`. Token **names are stable** (they predate this redesign); their values define the look. Components use tokens; one-off gradients/glows are allowed only as decorative layers.

## 1. Color Tokens

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--color-cream` | `#FFFFFF` | Page canvas | — |
| `--color-paper` | `#FFFFFF` | Raised surfaces (recipe card, price box) | — |
| `--color-linen` | `#F6F5F3` | Subtle surfaces: chips, segmented controls, meta tiles | — |
| `--color-charcoal` | `#111110` | Headings, body ink, primary dark buttons, e-book banner | 18.9 : 1 |
| `--color-stone` | `#4A4744` | Secondary text, deks | 9.0 : 1 |
| `--color-muted` | `#8B8782` | Meta labels, captions (non-essential) | 3.6 : 1 |
| `--color-hairline` | `#EBE8E4` | Borders, dividers | — |
| `--color-brand` | `#EE8005` | Logo orange: decorative surfaces only (cover gradient, glows), never text on white | 2.6 : 1 |
| `--color-terracotta` | `#B45309` | Accent (logo hue, darkened for AA): CTAs, links, category labels, active states | 5.0 : 1 |
| `--color-terracotta-deep` | `#92400E` | Accent hover / text on tint | 7.3 : 1 |
| `--color-terracotta-tint` | `#FFF4E3` | Pills, newsletter card, blockquotes, step numbers | — |
| `--color-olive` | `#3F6212` | Success, completed steps | 7.6 : 1 |
| `--color-olive-tint` | `#ECF5DC` | Checked ingredient wash | — |
| `--color-butter` | `#FCD34D` | Decorative only (dev badge, ratings) | — |
| `--color-danger` | `#B42318` | Form errors | 6.2 : 1 |

Rules: text ≥ 4.5:1 (WCAG AA). Accent covers < 10% of a viewport, except the e-book banner (dark) and newsletter card (tint).

## 2. Typography

Loaded with `next/font/google` (self-hosted, `display: 'swap'`) in `src/app/fonts.ts`, exposed as CSS variables on `<html>`.

| Role | TR / EN | AR |
|---|---|---|
| Display, H1–H3, wordmark, prices | Plus Jakarta Sans 700/800 (`latin`, `latin-ext`) | IBM Plex Sans Arabic 700 |
| Body, deks, UI, forms | Inter 400–600 | IBM Plex Sans Arabic 400–600 |

`font-serif` remains as a legacy alias of the body sans. No italics anywhere (Arabic has none; the modern system doesn't need them). Locale switch: `[data-script=arabic]` (on `<html>` or any subtree) swaps all three families to IBM Plex Sans Arabic, sets tracking to 0 and adds leading.

Type scale (fluid, `clamp`):

| Token | Size | Line height | Tracking (Latin) |
|---|---|---|---|
| `display` | clamp(2.5rem, 1.4rem + 4.6vw, 5.25rem), weight 800 | 1.02 | -0.04em |
| `h1` | clamp(2.125rem, 1.5rem + 2.6vw, 3.75rem), 800 | 1.06 | -0.035em |
| `h2` | clamp(1.625rem, 1.3rem + 1.4vw, 2.5rem), 800 | 1.12 | -0.025em |
| `h3` | 1.3125rem, 700 | 1.3 | -0.015em |
| `dek` | 1.1875rem | 1.6 | 0 |
| `body` | 1.125rem | 1.75 | 0 |
| `ui` | 0.9375rem | 1.5 | 0 |
| `eyebrow` | 0.75rem, 600, uppercase (Latin only) | 1.2 | 0.08em |

Headings use `text-wrap: balance`. Measure: article body `68ch`; recipe card `min(100%, 48rem)`.

## 3. Layout & Shape

- Containers: `content` 720px (article), `wide` 1152px (article hero image, e-book detail), `page` 1280px (home, archives). Side gutter 16px on phones, 24px from `sm`.
- Radii: `--radius-card` 1.25rem (cards, images); 2rem for hero/feature images, recipe card, e-book banner and newsletter card; `rounded-pill` for every button, chip and segmented control.
- Shadows: `shadow-card` (soft, resting) and `shadow-lift` (covers, hover).
- Home: hero = headline + two pill CTAs (start) beside a full-bleed **feature card** (image, gradient overlay, title + meta chips in white). Then "Latest" in a 3-column card grid (lead excluded), then the dark e-book banner.
- Images: `aspect-[4/3]` cards, `aspect-[16/10]` article hero, `aspect-[4/5]` feature card. Image-less posts get a category-tinted gradient with a bowl glyph (`EditorialImage`), never an empty grey box.
- Motion: 200–500ms with `--ease-editorial`; cards zoom images 4% on hover; respect `prefers-reduced-motion`.
- **RTL:** logical utilities only (`ms/me/ps/pe/start/end/text-start`); directional icons use `rtl:-scale-x-100`.

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
╭──────────────────────────────────────────────────────────╮ full: bg-charcoal, rounded-[2rem], orange glow
│ ╭────────╮  FROM THE KITCHEN… (eyebrow, orange-300)        │
│ │ cover  │  Sourdough Basics (h2, 800, white)               │
│ │ 3:4    │  Subtitle (dek, white/75)                        │
│ │ lift   │  180 pages · PDF                                 │
│ ╰────────╯  ₺349,00   ( Buy the e-book → )  ← white pill    │
╰──────────────────────────────────────────────────────────╯
compact: white card, hairline border, 56px cover, small accent pill button
inline:  tint pill row — label · linked title · price
```

| Aspect | Spec |
|---|---|
| Variants | `full` (default, after 2nd–3rd section) · `compact` (inside recipe card notes, cover 64px) · `inline` (single text line + link) |
| Price | `Intl.NumberFormat(locale, { style: 'currency', currency })` with `tr→TRY`, `en→USD`, `ar→SAR`. Note under price: "Final price & tax shown at checkout" (MoR may localize). |
| CTA | Pill button (accent on light surfaces, white on the dark banner), 48px height, opens MoR overlay via `POST /api/checkout` (payments.md). Loading state with spinner; error inline in `text-danger`. Arrow icon `rtl:-scale-x-100`. |
| Placement rules | Max one `full` callout per article; never above the fold; never inside the ingredient list. |
| Analytics | `data-ebook-callout={productSlug}` + `data-placement`; subscriber/checkout `source='ebook_callout'`. |
| Accessibility | `<aside aria-label>`; cover `alt` from `product_translations.cover_alt`; button text includes product title for screen readers. |

## 6. Other Core Components (tokens summary)

- **Logo:** the official round logo (`public/brand/logo-{96,192}.webp`, source 1080 px JPEG) beside the "Naif Mutfak" wordmark (Jakarta 800, always LTR). Also used for the favicon (`src/app/icon.png`, `apple-icon.png`), the default share image (`src/app/[locale]/opengraph-image.jpg`), e-book cover placeholders, the admin menu and the global 404.
- **Header:** sticky, white/85 with backdrop blur, hairline bottom border, logo at `start`. Nav links are pill hovers; on phones they move to a scrollable second row. Locale switcher is a segmented pill (TR · EN · ع) with endonyms as accessible names.
- **Story card:** 4:3 rounded image with category pill overlaid at `start`, then meta chips (⏱ total time, difficulty bars), bold title (turns accent on hover), 2-line dek. Whole card is clickable (stretched link).
- **Recipe card:** white, 2rem radius, meta tiles in `linen`, servings as a segmented pill control, ingredients as rounded checkable rows, steps with tinted number circles (olive when done).
- **Newsletter:** tint card with soft glow; email field and button joined in one white pill.
- **Footer:** wordmark + tagline, explore links, small copyright.
- **Buttons:** primary dark pill (charcoal → accent on hover) or accent pill for purchases; secondary white pill with hairline border. Focus ring: 2px accent outline, 3px offset.
