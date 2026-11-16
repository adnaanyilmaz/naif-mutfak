# Recipe Auto-Translation (TR → EN/AR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the admin post editor, turn a saved Turkish post into EN and AR draft translations with a deterministic + AI check report, using only the free Workers AI allocation.

**Architecture:** A server action per target locale reads the saved TR translation, asks a Workers AI text model to translate *strings only* (ids, quantities, timers and image keys are copied from TR by code, never by the model), runs code checks plus a second-model review, and upserts the `post_translations` row with `isPublished = false` and AI metadata columns. "Hand-edited" and "out of date" are derived from content hashes, so the existing save flow is untouched.

**Tech Stack:** Next.js server actions on Workers (OpenNext), Workers AI binding (`AI`), D1 + Drizzle, Zod 4, Vitest, next-intl.

**Spec:** `docs/superpowers/specs/2026-11-16-auto-translation-design.md`

## Global Constraints

- All rules in `CLAUDE.md` apply: layering (`app` → `services` → `repositories` → `lib/cloudflare`), zero `any`, no `as` except `as const`/post-Zod narrowing, named exports, Web Crypto only, logical CSS only, all UI strings in `messages/{tr,en,ar}.json`.
- Free tooling only: Workers AI, 10,000 Neurons/day, resets 00:00 UTC. No other provider, no Queues.
- Models (wrangler `vars`, swappable): `AI_TRANSLATE_MODEL = "@cf/google/gemma-4-26b-a4b-it"`, `AI_REVIEW_MODEL = "@cf/zai-org/glm-4.7-flash"`.
- Translations are always written with `isPublished = false`. Nothing auto-publishes.
- A translation that is hand-written, hand-edited, or currently published is never overwritten without `overwrite: true`.
- The translate write must NOT change `posts.updated_at` (editor concurrency token), same as `setHeroImage`.
- Never log or audit titles/bodies; audit diff carries locale and counts only.
- Migrations: `npm run db:generate` → review SQL → `npm run db:migrate:local`. Never `--remote` without owner approval.
- Quality gates before each commit: `npm run typecheck`, `npm run lint`, `npm run test`.
- Commit after each task; never push.

## Review Focus

1. **Model returns prose, fenced JSON, or broken JSON** → one retry, then `model_output`; nothing is written. (Task 3 `parseModelJson`, Task 6.)
2. **Model drops, renames or reorders ingredient/step ids** → merge by id, keep TR text for the missing ones, report `missing_item`; quantities never change. (Task 4.)
3. **Translated text exceeds column limits** (e.g. `seoTitle` > 120) → clamp at a word boundary, report `clamped`; the row still passes `postTranslationInputSchema`. (Task 4.)
4. **Arabic title slugifies to empty or a taken slug** → fallback `${trSlug}-${locale}`, then `-2…-9` suffixes; an existing target slug is kept. (Task 6.)
5. **Daily quota exhausted mid-run** (translate succeeds, review fails; or translate itself fails) → review failure still saves with `reviewed: false`; translate failure returns `quota` and writes nothing. (Task 6.)
6. **Untouched AI translation looks "hand-edited" after an unrelated TR save** (editor round-trips every locale through the form) → content hash is computed over a normalized text-only projection. (Task 5.)

## File Structure

| File | Responsibility |
|---|---|
| `wrangler.jsonc`, `cloudflare-env.d.ts` (generated) | `AI` binding + two model vars |
| `src/validators/env.ts` | `aiEnvSchema` / `parseAiEnv` |
| `src/lib/cloudflare/ai.ts` | `getTextModel()` — only file touching `env.AI` |
| `src/validators/admin/translation.ts` | Zod: action input, model payload, model review, report |
| `src/services/translation/model-output.ts` | Pure parsing of raw model responses + error classification |
| `src/services/translation/payload.ts` | TR → string payload; merge model strings back by id; clamp |
| `src/services/translation/checks.ts` | Deterministic checks |
| `src/services/translation/content-hash.ts` | Normalized hash + origin/outdated state |
| `src/services/translation/prompts.ts` | System/user prompt builders, body chunking |
| `src/services/admin/post-translate.service.ts` | Orchestration (`translatePost`) |
| `src/db/schema.ts`, `migrations/0002_*.sql` | 4 AI metadata columns on `post_translations` |
| `src/repositories/admin-posts.ts` | `aiMeta` on `find`, `saveAiTranslation` |
| `src/services/container.ts`, `src/app/admin/posts/actions.ts`, `src/app/admin/posts/[id]/page.tsx` | Wiring |
| `src/components/admin/TranslateBar.tsx`, `PostEditor.tsx`, `messages/*.json` | UI |
| `docs/architecture/admin.md` | §2 addendum |

---

### Task 1: Workers AI binding, env, and text-model adapter

**Files:**
- Modify: `wrangler.jsonc`, `src/validators/env.ts`, `src/lib/cloudflare/env.ts`
- Create: `src/lib/cloudflare/ai.ts`
- Test: `src/validators/env.test.ts`

**Interfaces — Produces:**
```ts
// validators/env.ts
export const aiEnvSchema; export type AiEnv = { AI_TRANSLATE_MODEL: string; AI_REVIEW_MODEL: string };
export function parseAiEnv(source: Record<string, unknown>): AiEnv;   // throws EnvValidationError
// lib/cloudflare/env.ts
export function getAiEnv(): AiEnv;
// lib/cloudflare/ai.ts
export interface TextModelRequest { model: string; system: string; user: string; json: boolean; maxTokens: number }
export type TextModel = (req: TextModelRequest) => Promise<unknown>;  // raw provider response; throws on transport/quota errors
export function getTextModel(): TextModel;
```

- [ ] **Step 1: Failing test** in `env.test.ts`:
```ts
it('parses AI model ids and rejects non-Workers-AI ids', () => {
  expect(parseAiEnv({ AI_TRANSLATE_MODEL: '@cf/google/gemma-4-26b-a4b-it', AI_REVIEW_MODEL: '@cf/zai-org/glm-4.7-flash' }).AI_REVIEW_MODEL).toBe('@cf/zai-org/glm-4.7-flash');
  expect(() => parseAiEnv({ AI_TRANSLATE_MODEL: 'gpt-4', AI_REVIEW_MODEL: '' })).toThrow(EnvValidationError);
});
```
- [ ] **Step 2:** `npx vitest run src/validators/env.test.ts` → FAIL (`parseAiEnv` not exported).
- [ ] **Step 3:** Add `aiEnvSchema` (both fields `z.string().regex(/^@(cf|hf)\//)`) and `parseAiEnv` following `parsePaymentEnv`; add `getAiEnv()` next to `getUploadEnv()`.
- [ ] **Step 4:** In `wrangler.jsonc` add `"ai": { "binding": "AI" }` and the two vars from Global Constraints. Run `npm run cf-typegen`; confirm `AI: Ai` appears in `cloudflare-env.d.ts`.
- [ ] **Step 5:** Implement `getTextModel()` in `lib/cloudflare/ai.ts`: `getBindings().AI.run(req.model, { messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }], max_completion_tokens: req.maxTokens, temperature: 0.2, ...(req.json ? { response_format: { type: 'json_object' } } : {}) })` and return the result untyped (`unknown`). Before writing it, open the model page `https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/` ("API Schemas (Raw)") and confirm the parameter names; the model is a reasoning model — if the schema documents a way to disable thinking, set it so reasoning does not consume `maxTokens`. If `run`'s generated types reject the model id string, validate the id with a Zod schema typed against `keyof AiModels` rather than casting.
- [ ] **Step 6:** `npm run typecheck && npm run lint && npx vitest run src/validators/env.test.ts` → PASS.
- [ ] **Step 7:** Commit `feat(ai): Workers AI binding and text-model adapter`.

---

### Task 2: Report schema, metadata columns, repository

**Files:**
- Create: `src/validators/admin/translation.ts`
- Modify: `src/db/schema.ts`, `src/repositories/admin-posts.ts`, new `migrations/0002_*.sql`
- Test: `src/validators/admin/translation.test.ts`, `src/repositories/admin.integration.test.ts`

**Interfaces — Produces:**
```ts
// validators/admin/translation.ts
export const TARGET_LOCALES = ['en', 'ar'] as const; export type TargetLocale = 'en' | 'ar';
export const translateInputSchema = z.object({ postId: z.guid(), locale: z.enum(TARGET_LOCALES), overwrite: z.boolean().default(false) });
export const CHECK_CODES = ['missing_item', 'untranslated', 'clamped', 'wrong_script', 'numbers',
  'body_headings', 'body_lists', 'body_directives', 'body_links'] as const;
export const translationCheckSchema = z.object({ code: z.enum(CHECK_CODES), field: z.string().max(80) });
export const reviewIssueSchema = z.object({ severity: z.enum(['error', 'warning']), field: z.string().max(80), message: z.string().max(400) });
export const translationReportSchema = z.object({
  checks: z.array(translationCheckSchema).max(50),
  review: z.array(reviewIssueSchema).max(20),
  reviewed: z.boolean(),            // false when the AI review call failed
});
const text = z.string().nullable();
export const modelPayloadSchema = z.object({
  title: z.string().min(1), dek: text, heroImageAlt: text, seoTitle: text, seoDescription: text, cuisine: text,
  keywords: z.array(z.string()),
  groupTitles: z.array(text),       // ingredient group titles, by group index
  ingredients: z.array(z.object({ id: z.string(), name: z.string(), unit: text, note: text })),
  sectionTitles: z.array(text),     // instruction section titles, by section index
  steps: z.array(z.object({ id: z.string(), text: z.string() })),
});
export const modelReviewSchema = z.object({ issues: z.array(reviewIssueSchema.extend({ message: z.string() })) });
export type TranslateInput, TranslationCheck, ReviewIssue, TranslationReport, ModelPayload;

// repositories/admin-posts.ts
export interface AiTranslationMeta { sourceHash: string; contentHash: string; report: TranslationReport; translatedAt: Date }
export interface AdminPostRecord { /* existing */ aiMeta: Partial<Record<Locale, AiTranslationMeta>> }
export interface AiTranslationWrite { postId: string; translation: AdminTranslation; meta: AiTranslationMeta; audit: AuditEntry }
interface AdminPostsRepo { saveAiTranslation(w: AiTranslationWrite): Promise<'saved' | 'slug_taken'> }
```
`AdminTranslation` itself is unchanged (so `savePost` keeps compiling).

- [ ] **Step 1: Failing tests.** `translation.test.ts`: `translateInputSchema` rejects `locale: 'tr'` and defaults `overwrite` to `false`; `translationReportSchema` rejects an unknown check code. In `admin.integration.test.ts` (follow its existing setup): after `createDraft` + `save` of a TR translation, `saveAiTranslation` of an `en` row then `find` → `translations` has `en` with `isPublished === false`, `aiMeta.en?.sourceHash === 'h1'`, `aiMeta.tr === undefined`, and `find(...).updatedAt` equals its value before the call; a second `saveAiTranslation` for a different post with the same `en` slug resolves `'slug_taken'`.
- [ ] **Step 2:** Run both test files → FAIL.
- [ ] **Step 3:** Write `validators/admin/translation.ts` as specified.
- [ ] **Step 4:** In `schema.ts` add to `postTranslations`: `aiSourceHash: text('ai_source_hash')`, `aiContentHash: text('ai_content_hash')`, `aiReportJson: text('ai_report_json', { mode: 'json' }).$type<TranslationReport>()`, `aiTranslatedAt: integer('ai_translated_at', { mode: 'timestamp' })` (all nullable). Run `npm run db:generate`; the migration must contain exactly four `ALTER TABLE post_translations ADD` statements. Run `npm run db:migrate:local`.
- [ ] **Step 5:** Repo: `find` builds `aiMeta` from rows where all four columns are non-null and `aiReportJson` passes `translationReportSchema.safeParse` (otherwise the locale is omitted). `saveAiTranslation` runs one `db.batch`: upsert on `(postId, locale)` setting every content column, `isPublished`, the four AI columns and `updatedAt`; plus `auditInsert`. Map `isUniqueViolation(err, 'post_translations.locale')` → `'slug_taken'`. No statement touches `posts`.
- [ ] **Step 6:** Tests + typecheck + lint → PASS. Fix any fake `AdminPostsRepo` in `admin-services.test.ts` that no longer satisfies the interface.
- [ ] **Step 7:** Commit `feat(db): AI translation metadata on post_translations`.

---

### Task 3: Model output parsing and error classification

**Files:**
- Create: `src/services/translation/model-output.ts`
- Test: `src/services/translation/model-output.test.ts`

**Interfaces — Produces:**
```ts
export function extractModelText(raw: unknown): string | null;
export function parseModelJson(raw: unknown): unknown | null;      // null when no JSON object can be recovered
export function stripFence(text: string): string;                  // removes one wrapping ``` / ```markdown fence
export function classifyAiError(err: unknown): 'quota' | 'ai_unavailable';
```

- [ ] **Step 1: Failing tests:**
```ts
expect(extractModelText({ choices: [{ message: { content: 'hi' } }] })).toBe('hi');
expect(extractModelText({ response: 'hi' })).toBe('hi');
expect(extractModelText({ response: { a: 1 } })).toBe('{"a":1}');
expect(extractModelText({})).toBeNull();
expect(parseModelJson({ response: 'Sure!\n```json\n{"title":"Bread"}\n```\nDone.' })).toEqual({ title: 'Bread' });
expect(parseModelJson({ response: { title: 'Bread' } })).toEqual({ title: 'Bread' });
expect(parseModelJson({ response: 'no json here' })).toBeNull();
expect(parseModelJson({ response: '{"title": "Bre' })).toBeNull();
expect(stripFence('```markdown\n# A\n```')).toBe('# A');
expect(stripFence('# A')).toBe('# A');
expect(classifyAiError(new Error('4006: you have used up your daily free allocation of 10,000 neurons'))).toBe('quota');
expect(classifyAiError(new Error('429 Too Many Requests'))).toBe('quota');
expect(classifyAiError(new Error('3040: out of capacity'))).toBe('ai_unavailable');
expect(classifyAiError('boom')).toBe('ai_unavailable');
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Response shapes are read with Zod (`z.union` of the `choices[0].message.content` shape and the `response` shape), never casts. `parseModelJson` takes the substring from the first `{` to the last `}` and `JSON.parse`s inside try/catch. `classifyAiError` returns `'quota'` when the message matches `/\b(4006|429)\b|daily|allocation|neurons?/i`; confirm the daily-limit code against `https://developers.cloudflare.com/workers-ai/platform/errors/` and add it to the regex if it differs.
- [ ] **Step 4:** Run → PASS. Commit `feat(translation): model output parsing`.

---

### Task 4: Payload extraction, merge and clamping

**Files:**
- Create: `src/services/translation/payload.ts`
- Test: `src/services/translation/payload.test.ts`

**Interfaces:**
- Consumes: `ModelPayload`, `TranslationCheck` (Task 2); `AdminTranslation`.
- Produces:
```ts
export type TranslatedContent = Omit<AdminTranslation, 'locale' | 'slug' | 'isPublished' | 'bodyMd'>;
export function toPayload(source: AdminTranslation): ModelPayload;
export function mergePayload(source: AdminTranslation, model: ModelPayload): { content: TranslatedContent; checks: TranslationCheck[] };
```

Rules for `mergePayload`: the result's ingredient/instruction structure is a copy of `source` (same groups, order, ids, `quantity`, `quantityMax`, `unitGrams`, `scalable`, `imageKey`, `timerSeconds`); only `name`, `unit`, `note`, `text` and titles come from `model`, looked up **by id** (titles by index). An id missing from `model`, or an empty `name`/`text`, keeps the source string and adds `{ code: 'missing_item', field: 'ingredients.<id>' | 'steps.<id>' }`. Ids in `model` that are not in `source` are ignored. Empty/whitespace nullable fields become `null` (`unit`/`note`/titles become absent). Clamp to the limits in `validators/admin/post.ts` and `validators/content.ts` (title 200, dek 400, heroImageAlt 300, seoTitle 120, seoDescription 320, cuisine 80, keyword 60 × max 20, name 200, unit 24, note 200, group/section title 120, step text 2000), cutting at the last whitespace before the limit, each adding `{ code: 'clamped', field }`. Empty keywords are dropped.

- [ ] **Step 1: Failing tests** with a TR fixture of two ingredients (`flour`: 500 g "un"; `salt`: 10 g "tuz", note "ince") and two steps (`s1` with `timerSeconds: 600`, `s2`):
  - `toPayload` output passes `modelPayloadSchema` and contains no numeric quantity anywhere.
  - Happy path: model returns names "flour"/"salt" in **reverse order** → result order is `flour, salt`, quantities `500`/`10` unchanged, `checks` is `[]`.
  - Model omits `salt` and returns `s2` with `text: ''` → `salt.name === 'tuz'`, `s2.text` equals TR text, checks contain `missing_item` for `ingredients.salt` and `steps.s2`.
  - Model adds an unknown id `sugar` → not present in result.
  - Model `seoTitle` of 200 chars → result length ≤ 120, does not end mid-word, check `{ code: 'clamped', field: 'seoTitle' }`.
  - `postTranslationInputSchema.safeParse({ ...content, locale: 'en', slug: 'x', bodyMd: '', isPublished: false }).success === true` for every case above.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(translation): string payload and id-safe merge`.

---

### Task 5: Deterministic checks and content hash

**Files:**
- Create: `src/services/translation/checks.ts`, `src/services/translation/content-hash.ts`
- Test: `src/services/translation/checks.test.ts`, `src/services/translation/content-hash.test.ts`

**Interfaces — Produces:**
```ts
// checks.ts
export function runChecks(source: AdminTranslation, target: AdminTranslation): TranslationCheck[];
// content-hash.ts
export function contentHash(t: Omit<AdminTranslation, 'locale' | 'slug' | 'isPublished'>): Promise<string>; // SHA-256 hex
export type TranslationOrigin = 'none' | 'manual' | 'ai' | 'ai_edited';
export interface TranslationStatus { origin: TranslationOrigin; outdated: boolean; report: TranslationReport | null }
export function describeTranslation(source: AdminTranslation | undefined, target: AdminTranslation | undefined, meta: AiTranslationMeta | undefined): Promise<TranslationStatus>;
```

`runChecks` (target locale = `target.locale`):
- `untranslated` — field `title` when titles are equal ignoring case/whitespace; field `instructions` when more than half of step texts are identical to source.
- `wrong_script` — for `ar`: in each of `title`, `dek`, `bodyMd`, every step text, Arabic-script letters (`\p{Script=Arabic}`) are < 60 % of all letters (`\p{L}`), fields with fewer than 4 letters skipped. For `en`: any Arabic-script letter in those fields. One check per offending field (`steps.<id>` for steps).
- `numbers` — the sorted list of numeric tokens differs between source and target, compared per `bodyMd`, per step (`steps.<id>`), per ingredient note (`ingredients.<id>`). Tokens: `/\d+(?:[.,]\d+)?|[½¼¾⅓⅔]/g` after mapping Arabic-Indic digits `٠-٩` and `۰-۹` to ASCII and `,`/`٫` to `.`.
- `body_headings` — count of ATX headings per level differs. `body_lists` — count of list-item lines (`/^\s*(?:[-*+]|\d+[.)])\s/m`) differs. `body_links` — the sorted set of link/image URLs (`/\]\(([^)\s]+)/g`) differs. `body_directives` — the sorted list of directive `name + {attrs}` differs; take the directive syntax actually supported from `src/services/content/markdown.ts`. All four use field `bodyMd`.

`contentHash` input is a normalized projection so a form round-trip cannot change it: `[title, dek, bodyMd, heroImageAlt, seoTitle, seoDescription, cuisine]` each `(v ?? '').trim()`; `keywords` trimmed; ingredients as `groups.map(g => [(g.title ?? '').trim(), g.items.map(i => [i.id, i.name.trim(), (i.unit ?? '').trim(), (i.note ?? '').trim()])])`; instructions as `sections.map(s => [(s.title ?? '').trim(), s.steps.map(st => [st.id, st.text.trim()])])`; `null` lists as `[]`. `JSON.stringify` of that array → `crypto.subtle.digest('SHA-256')` → lowercase hex. (Quantities are deliberately excluded: `diffStructure` already warns on quantity drift.)

`describeTranslation`: no target → `none`; no meta → `manual`; `contentHash(target) === meta.contentHash` → `ai`, else `ai_edited`. `outdated` = meta and source exist and `contentHash(source) !== meta.sourceHash`. `report` = `meta?.report ?? null`.

- [ ] **Step 1: Failing tests.**
  - checks: identical-structure EN target of a TR source → `[]`. Step "180°C'de 25 dakika pişirin" → "Bake at 180°C for 20 minutes" → `{ code: 'numbers', field: 'steps.s1' }`. Arabic step using `١٨٠` and `٢٥` → no `numbers` check. `ar` target whose `title` is Latin text → `wrong_script` on `title`. Body with `## A\n- x\n- y\n[l](https://a.b/c)` vs target missing one list item and with URL `https://a.b/d` → `body_lists` and `body_links`, not `body_headings`. EN title equal to TR title → `untranslated`.
  - hash: 64 hex chars; changing a step text changes it; changing `quantity`, `timerSeconds`, `slug` or `isPublished` does not; `dek: null` and `dek: ''` hash equal; **round-trip**: build an `AdminPostRecord` with the fixture, `const input = toSaveInput(toPostForm(record), id, 0)`, and for each locale `contentHash(input.translations[i])` equals `contentHash(record.translations[i])` (fixture includes a step with `timerSeconds: 90` and an ingredient without `unit`).
  - describe: the four origins and `outdated` true/false as defined.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement both files. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(translation): deterministic checks and content hashing`.

---

### Task 6: Prompts and the `translatePost` service

**Files:**
- Create: `src/services/translation/prompts.ts`, `src/services/admin/post-translate.service.ts`
- Modify: `src/services/admin/posts-admin.service.ts` (export `pathsFor`)
- Test: `src/services/translation/prompts.test.ts`, `src/services/admin/post-translate.service.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5; `slugify` from `@/services/content/slug`; `postTranslationInputSchema`.
- Produces:
```ts
// prompts.ts
export const BODY_CHUNK_CHARS = 12_000;
export function splitBody(bodyMd: string): string[];                       // [] for blank body; chunks join with '\n\n' to the original
export function payloadPrompt(target: TargetLocale, payload: ModelPayload): { system: string; user: string };
export function bodyPrompt(target: TargetLocale, chunk: string): { system: string; user: string };
export function reviewPrompt(target: TargetLocale, source: AdminTranslation, translated: AdminTranslation, checks: TranslationCheck[]): { system: string; user: string };

// post-translate.service.ts
export interface PostTranslateDeps {
  posts: Pick<AdminPostsRepo, 'find' | 'isSlugTaken' | 'saveAiTranslation'>;
  model: TextModel; translateModel: string; reviewModel: string; now: () => Date;
}
export type TranslateError = 'not_found' | 'source_missing' | 'needs_confirm' | 'quota' | 'ai_unavailable' | 'model_output' | 'slug';
export type TranslateResult =
  | { ok: true; translation: AdminTranslation; status: TranslationStatus; revalidate: string[] }
  | { ok: false; error: TranslateError };
export function translatePost(deps: PostTranslateDeps, actor: AdminIdentity, input: TranslateInput): Promise<TranslateResult>;
```

Prompt copy (fixed; `{LANG}` = `English` | `Modern Standard Arabic`):
- payload system: `You are a professional culinary translator. Translate Turkish recipe text into {LANG}. Return ONLY one JSON object with exactly the same keys, array lengths and "id" values as the input. Translate every string value except "id". Keep null as null. Do not add, remove, merge or reorder items. Use natural cooking vocabulary of the target language; translate units (e.g. "su bardağı" → the usual equivalent word) but never convert or change amounts. Keep dish names that have no established translation in their original form, transliterated for Arabic.` — user: the payload JSON.
- body system: `You are a professional culinary translator. Translate the following Turkish Markdown into {LANG}. Output ONLY the translated Markdown. Keep every Markdown marker, heading level, list item, link URL, image URL and directive (lines or spans starting with ":" and anything inside "{...}") exactly as they are; translate only human-readable text. Never change numbers, temperatures or times.` — user: the chunk.
- review system: `You are a meticulous bilingual recipe editor. Compare the Turkish source with its {LANG} translation. Report only real problems: missing or added information, wrong ingredient or technique terms, wrong units, changed numbers, unnatural or misleading wording. Return ONLY JSON: {"issues":[{"severity":"error"|"warning","field":"<field name or steps.<id> or ingredients.<id>>","message":"<one sentence, written in Turkish>"}]}. Return {"issues":[]} when the translation is good. At most 10 issues.` — user: JSON `{ source, translation, automatedChecks }` where both sides carry title, dek, seo fields, ingredients `[id, name, unit, note]`, steps `[id, text]`, and `bodyMd` truncated to 8,000 chars.

`splitBody`: one chunk when length ≤ `BODY_CHUNK_CHARS`; otherwise split on blank lines and greedily pack blocks into chunks ≤ `BODY_CHUNK_CHARS` (a single oversized block is its own chunk). Never split inside a fenced code block or a `:::` container.

`translatePost` flow — token budgets: payload 8,000, each body chunk 8,000, review 1,500:
1. `find` → `not_found`. TR translation missing or blank title → `source_missing`.
2. `describeTranslation(tr, target, post.aiMeta[locale])`. If target exists and (`origin` is `manual` or `ai_edited`, or `target.isPublished`) and `!input.overwrite` → `needs_confirm`.
3. Payload call (`json: true`, `translateModel`) → `parseModelJson` → `modelPayloadSchema`. On parse/schema failure retry once, then `model_output`. A thrown call → `classifyAiError`.
4. Body: for each `splitBody(tr.bodyMd)` chunk, sequentially, `json: false`; `stripFence(extractModelText(...))`; empty → `model_output`. Join with `'\n\n'`. Blank source body → `''` with no call.
5. `mergePayload` → content. Slug: keep `target.slug` when the target already has one; else `slugify(content.title, locale)`, or `${tr.slug}-${locale}` when that is empty; while `isSlugTaken(locale, slug, postId)` try suffixes `-2` … `-9` (respecting `SLUG_MAX`); still taken → `slug`.
6. Assemble `AdminTranslation` with `isPublished: false`; `postTranslationInputSchema.safeParse` failure → `model_output`.
7. `checks = [...merge.checks, ...runChecks(tr, translation)]` capped at 50.
8. Review call (`json: true`, `reviewModel`) → `modelReviewSchema`; messages clamped to 400 chars, list to 20. ANY failure here (throw, parse, schema) → `review: [], reviewed: false`; the translation is still saved.
9. `saveAiTranslation` with `meta = { sourceHash: contentHash(tr), contentHash: contentHash(translation), report, translatedAt: now() }` and audit `{ actorEmail, action: 'post.translate', entityType: 'post', entityId, diff: { locale, checks: n, review: n, reviewed, overwrite } }`. `'slug_taken'` → `slug`.
10. Return `status: { origin: 'ai', outdated: false, report }` and `revalidate` = `pathsFor(locale, target.slug)` when the previous target was published, else `[]`.

- [ ] **Step 1: Failing tests.** `prompts.test.ts`: `splitBody('')` → `[]`; a 30,000-char body of 1,000-char paragraphs → every chunk ≤ 12,000 and `chunks.join('\n\n') === body`; a fenced block straddling the boundary stays in one chunk; `payloadPrompt('ar', p).system` contains `Modern Standard Arabic`. `post-translate.service.test.ts` uses an in-memory `posts` fake and a scripted `model` fake (queue of responses / thrown errors, recording `req.model` and `req.json`):
  - happy path `en`: 3 calls (payload, body, review) with models `[translate, translate, review]`; saved row has `isPublished: false`, TR quantities, slug `slugify(title,'en')`; result `status.origin === 'ai'`; audit diff has no title/body text.
  - blank TR body → 2 calls. No TR translation → `source_missing`, 0 calls.
  - target `manual` without overwrite → `needs_confirm`, 0 calls, nothing saved; with `overwrite: true` → saved.
  - target published + `origin: 'ai'` without overwrite → `needs_confirm`; with overwrite → saved unpublished, `revalidate` contains `/en/blog/<old-slug>`, slug unchanged.
  - payload response `'not json'` twice → `model_output`, nothing saved; once then valid → ok.
  - payload call throws `Error('4006 … daily free allocation')` → `quota`, nothing saved.
  - review call throws the same error → ok, `status.report.reviewed === false`.
  - `ar` title `'!!!'` → slug `<trSlug>-ar`; `isSlugTaken` true for the base and `-2` → slug ends `-3`; always taken → `slug`.
  - model changes a quantity-bearing step number → saved, report contains a `numbers` check.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `prompts.ts`, export `pathsFor`, implement the service. **Step 4:** Run → PASS; `npm run typecheck && npm run lint`.
- [ ] **Step 5:** Commit `feat(admin): translatePost service`.

---

### Task 7: Wiring — container, action, edit view

**Files:**
- Modify: `src/services/container.ts`, `src/app/admin/posts/actions.ts`, `src/services/admin/posts-admin.service.ts`, `src/services/admin/post-form.ts`, `src/app/admin/posts/[id]/page.tsx`
- Test: `src/services/admin/admin-services.test.ts`

**Interfaces — Produces:**
```ts
// container.ts
export function postTranslateDeps(): PostTranslateDeps;     // getTextModel() + getAiEnv() + createAdminPostsRepo(getDb())
// posts-admin.service.ts
export interface AdminPostEditView { /* existing */ translationStatus: Record<TargetLocale, TranslationStatus> }
// post-form.ts
export function translationToForm(t: AdminTranslation): TranslationForm;   // already exists; export it
// actions.ts
export type TranslateActionResult =
  | { ok: true; locale: TargetLocale; form: TranslationForm; status: TranslationStatus }
  | { ok: false; error: TranslateError | 'invalid' };
export async function translatePostAction(raw: unknown): Promise<TranslateActionResult>;
```

- [ ] **Step 1: Failing test** in `admin-services.test.ts`: `getPostForEdit` for a post with TR only → `translationStatus.en.origin === 'none'`; with an EN row and matching `aiMeta.en` → `'ai'`, `outdated: false`; after changing the TR title in the fake → `outdated: true`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Extend `getPostForEdit` (two `describeTranslation` calls). Add `postTranslateDeps`. Add `translatePostAction`: `requireAdmin()` → `translateInputSchema.safeParse` (failure → `{ ok: false, error: 'invalid' }`) → `translatePost` → on success `revalidatePath` each returned path plus `/admin/posts` → return `{ ok: true, locale, form: translationToForm(result.translation), status }`. Pass `translateAction={translatePostAction}` and `translationStatus={view.translationStatus}` to `PostEditor` (props added in Task 8; do both tasks before running typecheck on the page).
- [ ] **Step 4:** `npx vitest run src/services/admin` → PASS. Commit together with Task 8 if the page does not typecheck alone; otherwise commit `feat(admin): translate action and edit-view status`.

---

### Task 8: Editor UI

**Files:**
- Create: `src/components/admin/TranslateBar.tsx`
- Modify: `src/components/admin/PostEditor.tsx`, `messages/tr.json`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `TranslateActionResult`, `TranslationStatus`, `TargetLocale`, `CHECK_CODES`.
- Produces: `PostEditor` props `translateAction: (raw: unknown) => Promise<TranslateActionResult>` and `translationStatus: Record<TargetLocale, TranslationStatus>`.

Behaviour:
- `TranslateBar` is an `AdminCard` rendered directly above the content tabs. One row per target locale (`en`, `ar`): locale label, origin label, an "out of date" chip when `outdated`, a result chip — olive "no issues" when `checks.length + review.length === 0 && reviewed`, brand-coloured "N warnings" otherwise, plus "AI review unavailable" when `reviewed === false` — and a button ("Translate" when origin is `none`, else "Re-translate"). Clicking the warnings chip toggles a list: checks as `t('translate.checks.<code>', { field })`, review issues as their own (Turkish) message with a severity dot. Review messages are model output: render as plain text only.
- Buttons are disabled when the editor is `dirty`, a save is `pending`, a translation is running, or `form.translations.tr` is null; when disabled because of unsaved changes show the hint "Save the Turkish version first".
- One translation runs at a time; while running the row shows a spinner label and `aria-busy`.
- On `needs_confirm`: `window.confirm(t('translate.confirmOverwrite'))`; on OK call again with `overwrite: true`.
- On success: `const next = { ...form, translations: { ...form.translations, [locale]: result.form } }` → `setForm(next)`, `setSavedJson(JSON.stringify(next))`, `stored.clear()`, mark `slugTouched[locale] = true`, store `result.status` in local status state, switch the active tab to that locale.
- On other errors: an inline `role="alert"` under the row with `t('translate.errors.<code>')`.
- Logical CSS only; spinner/arrow icons need no RTL flip; layout must hold at phone width (row wraps, button full-width under `sm`).

Copy — add under `Admin.translate` (TR / EN; write AR as a faithful translation of the EN column):

| key | tr | en |
|---|---|---|
| `title` | Otomatik çeviri | Automatic translation |
| `hint` | Kaydedilmiş Türkçe metinden taslak çeviri üretir. Çeviriler yayınlanmaz; inceleyip siz yayınlarsınız. | Creates draft translations from the saved Turkish text. Nothing is published until you publish it. |
| `translate` / `retranslate` / `running` | Çevir / Yeniden çevir / Çevriliyor… | Translate / Re-translate / Translating… |
| `saveFirst` | Önce Türkçe sürümü kaydedin. | Save the Turkish version first. |
| `origin.none` / `.manual` / `.ai` / `.ai_edited` | Çeviri yok / Elle yazıldı / AI taslağı / AI taslağı (düzenlendi) | No translation / Written by hand / AI draft / AI draft (edited) |
| `outdated` | Türkçe değişti — güncel değil | Turkish changed — out of date |
| `clean` | Sorun bulunmadı | No issues found |
| `warnings` | {count} uyarı | {count, plural, one {# warning} other {# warnings}} |
| `notReviewed` | AI kontrolü yapılamadı | AI review unavailable |
| `confirmOverwrite` | Bu dildeki mevcut metin AI çevirisiyle değiştirilecek ve yayındaysa yayından kaldırılacak. Devam edilsin mi? | The existing text in this language will be replaced by the AI translation and unpublished if it is live. Continue? |
| `errors.quota` | Günlük ücretsiz AI kotası doldu. Yarın tekrar deneyin. | The free daily AI quota is used up. Try again tomorrow. |
| `errors.ai_unavailable` | AI servisi şu an yanıt vermiyor. Biraz sonra tekrar deneyin. | The AI service is not responding. Try again shortly. |
| `errors.model_output` | AI geçerli bir çeviri üretemedi. Tekrar deneyin. | The AI did not return a usable translation. Try again. |
| `errors.source_missing` | Önce Türkçe başlığı yazıp kaydedin. | Write and save the Turkish title first. |
| `errors.slug` | Bu dil için uygun bir URL adı bulunamadı. | No free URL slug was found for this language. |
| `errors.not_found` / `errors.invalid` | Yazı bulunamadı. / Geçersiz istek. | Post not found. / Invalid request. |
| `checks.missing_item` | {field}: çeviri eksik, Türkçe metin bırakıldı | {field}: translation missing, Turkish text kept |
| `checks.untranslated` | {field}: çevrilmemiş görünüyor | {field}: looks untranslated |
| `checks.clamped` | {field}: çok uzundu, kısaltıldı | {field}: too long, shortened |
| `checks.wrong_script` | {field}: beklenen dilde değil | {field}: not in the expected language |
| `checks.numbers` | {field}: sayılar Türkçe metinle uyuşmuyor | {field}: numbers differ from the Turkish text |
| `checks.body_headings` / `.body_lists` / `.body_links` / `.body_directives` | Metin: başlık sayısı farklı / liste maddesi sayısı farklı / bağlantılar farklı / özel bloklar farklı | Body: heading count differs / list item count differs / links differ / special blocks differ |

- [ ] **Step 1:** Add the message keys to all three files (same key set in each; run the existing messages-parity test if one exists, otherwise diff key lists).
- [ ] **Step 2:** Build `TranslateBar` and wire it into `PostEditor` as specified.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm run test` → all PASS.
- [ ] **Step 4: Browser verification** with `npm run dev` on a seeded post (stub path is fine if `wrangler login` is not available — then verify only disabled/enabled states and the error alert): Translate button disabled while the form is dirty; after saving, Translate → EN tab fills, top bar shows "all saved", chip shows a result; reload → state persists, `en` shows as unpublished; edit an EN field and save, reload → "AI draft (edited)", Re-translate asks for confirmation; change the TR title and save, reload → "out of date". Check the bar at 375 px width and under `/admin` in RTL-neutral layout.
- [ ] **Step 5:** Commit `feat(admin): translate bar in the post editor`.

---

### Task 9: Live smoke test, cost measurement, docs

**Files:**
- Modify: `docs/architecture/admin.md` (new subsection at the end of §2), `CLAUDE.md` (Docs Index line for admin.md gains "AI translation")

- [ ] **Step 1:** With `wrangler login` done by the owner, run the dev server and translate one real seeded recipe to EN and AR. Local dev calls the real Workers AI and spends real Neurons. If the account is not logged in, stop and ask the owner — do not work around it.
- [ ] **Step 2:** Read Neuron usage for those runs from the Workers AI dashboard (owner) and record "≈ N Neurons per recipe (both locales)" and the resulting recipes-per-day estimate in `admin.md`.
- [ ] **Step 3:** Read both translations with the owner; if the model systematically breaks a rule (e.g. translates directive attributes), tighten the prompt in `prompts.ts` and add the failing sample as a `runChecks` test fixture.
- [ ] **Step 4:** Write the `admin.md` subsection: trigger and data flow, the "model translates strings only" rule, metadata columns, origin/outdated derivation, error codes, quota behaviour, how to swap models via `vars`.
- [ ] **Step 5:** Full gates → PASS. Commit `docs(admin): AI translation`.

## Not in this plan
- Remote migration and deploy: `npx wrangler d1 migrations apply naif-mutfak-db --remote` and `npm run deploy` only on the owner's explicit request.
- Auto-publish setting, product/e-book translation, glossary.
