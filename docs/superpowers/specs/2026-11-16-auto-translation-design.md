# Auto-translation of recipes (TR → EN/AR) — Design

Date: 2026-11-16 · Status: approved by owner

## Intent
The owner writes each recipe once, in Turkish. The system produces English and Arabic
versions as **drafts** and checks them, so three-language publishing stops being manual work.
The owner keeps the final publish decision per locale.

## Goals
- After a Turkish post is saved, EN and AR translations can be generated from the admin editor.
- Every translatable field of `post_translations` is covered: `title`, `dek`, `bodyMd`,
  `heroImageAlt`, `seoTitle`, `seoDescription`, `ingredientsJson`, `instructionsJson`,
  `keywordsJson`, `cuisine`, plus a generated `slug`.
- Translations are saved with `isPublished = false`.
- Each translation gets a check result (deterministic checks + AI review) shown in admin.
- Zero running cost: free tooling only.

## Non-goals
- Auto-publishing translations (may be added later as an off-by-default setting).
- Translating products / e-books, UI strings, or anything outside posts.
- Background queues, cron re-translation, translation memory/glossary.

## Anti-goals
- Overwriting a translation the owner edited by hand without asking.
- A broken translation (missing ingredient, changed quantity) going live unnoticed.
- Blocking or slowing down the normal Turkish save.

## Constraints
- Cloudflare Workers via OpenNext; Web-standard APIs only; layering and Zod rules from `CLAUDE.md`.
- Workers AI free allocation: 10,000 Neurons/day (resets 00:00 UTC); some models are paid-only.
- D1 has no interactive transactions (`db.batch`).

## Approaches considered
- **A. Translate synchronously inside the save request.** Simplest, but two locales plus review
  can exceed request time; save becomes slow and fragile. Rejected.
- **B. Background queue + Claude API, drafts + review badges.** Best quality, but paid API and
  an extra Queues binding. Rejected by owner: must be free.
- **C. Workers AI, one admin-triggered request per locale, drafts + checks.** Free, no new
  account or secret, no queue. **Chosen.** Trade-off: lower quality than paid models
  (notably Arabic culinary terms), mitigated by draft-only saving and the two-layer check.

## Design (as decided)
- **Provider:** Workers AI through an `AI` binding in `wrangler.jsonc`.
  Translation model `@cf/google/gemma-4-26b-a4b-it`; review model `@cf/zai-org/glm-4.7-flash`.
  Model ids live in config/env so they can be swapped without code changes.
  (`m2m100` rejected: plain-text model, breaks markdown and structured lists.)
- **Trigger:** a "Translate to EN/AR" action in the post editor, available once the Turkish
  version is saved. One HTTP request per target locale; the editor shows per-locale progress.
- **Write:** result is upserted into `post_translations` for that locale with
  `isPublished = false`. Slug is derived from the translated title and made unique per locale.
- **Checks, layer 1 (code, deterministic):** numbers/quantities preserved, ingredient and step
  counts equal to source, markdown heading/list structure preserved, AR text is actually in
  Arabic script, required fields non-empty, model output passes the existing Zod schemas.
- **Checks, layer 2 (AI):** review model compares source and translation and returns a short
  list of issues (omissions, mistranslated culinary terms, unit errors).
- **Surface:** per-locale badge in admin — "no issues" / "N warnings" — with the warning list.
- **Safety rules:** a translation edited by hand is never overwritten without explicit
  confirmation. If the Turkish source changes after translating, the translation is marked
  "out of date" (source hash comparison).
- **Failure:** quota exhausted or model error → clear message in the editor, nothing written,
  retry later. No PII or bodies in logs.

## Left to the builder (my calls, not owner decisions)
- Storage shape for translation metadata (source hash, origin `ai`/`manual`, check report):
  new columns on `post_translations` vs. a side table.
- Prompt design, chunking of long `bodyMd`, JSON output enforcement and retry policy.
- Exact UI placement and copy (all strings in `messages/{tr,en,ar}.json`).
- Whether translation auto-starts after save or only on button press (default: button).
- Measuring real Neuron cost per recipe on first run and documenting it.
