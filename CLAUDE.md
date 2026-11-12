# Naif Mutfak — Engineering Rules

Editorial gastronomy blog + multi-language e-book storefront. Locales: `tr` (default), `en`, `ar` (RTL).
Runtime: Next.js App Router on Cloudflare Workers via `@opennextjs/cloudflare`. Data: D1 + Drizzle. Files: R2.

## Output Efficiency (mandatory)
- No conversational filler, preambles, or recaps. No summaries unless requested.
- Read only the files/line ranges needed. Prefer Grep/Glob over full reads. Never re-read a file just edited.
- Load `/docs` files on demand only when the task touches that domain (see Docs Index).
- Report results as a terse list of changed files + any blocker. Ask only when genuinely blocked.

## Docs Index (load on demand)
- Database schema, ERD, Drizzle conventions → [docs/architecture/database.md](docs/architecture/database.md)
- Checkout, webhooks, PDF delivery → [docs/architecture/payments.md](docs/architecture/payments.md)
- Design tokens, typography, Recipe Card, e-book callout → [docs/design/editorial-system.md](docs/design/editorial-system.md)
- `/admin` auth (Cloudflare Access JWT), i18n editor, presigned R2 uploads, analytics → [docs/architecture/admin.md](docs/architecture/admin.md)

## Directory Layout
```
src/
  app/[locale]/...        # Pages/layouts: render only. Call services; no queries, no business rules.
  app/api/**/route.ts     # Route Handlers: parse → validate → call service → map to Response. ≤ ~30 lines.
  services/               # Business logic. Pure TS, framework-agnostic. Receive deps (repos, env) as args.
  repositories/           # Only layer that imports Drizzle / touches D1. Returns typed domain objects.
  validators/             # Zod schemas: env, API inputs, webhook payloads, JSON columns.
  lib/cloudflare/         # env.ts (getEnv), db.ts (getDb), r2.ts, crypto.ts (Web Crypto helpers).
  db/schema.ts            # Drizzle schema (single source of truth). Migrations in /migrations.
  i18n/                   # next-intl routing, request config, locale→dir/currency maps.
  components/             # Presentational + client islands. No fetch to D1/R2, no pricing logic.
messages/{tr,en,ar}.json  # All UI strings. No hard-coded user-facing text in components.
```

## Layering Rules
- Dependency direction: `app` → `services` → `repositories` → `lib/cloudflare`. Never upward, never skip to repos from `app`.
- Zero business logic in React components or Route Handlers (pricing, entitlement, idempotency, signature checks all live in `services`).
- Services take explicit dependencies (`{ db, env, now }`) to stay unit-testable without Workers.
- One responsibility per file. Export named functions; no default exports outside `app/` route files.

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Zero `any`. No `as` casts except `as const` and narrowing after Zod parse. Use `unknown` + Zod at boundaries.
- `CloudflareEnv` comes from `wrangler types` only — run `npm run cf-typegen` after editing `wrangler.jsonc`.
  Script: `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`. Never hand-edit the generated file.
- Bindings are accessed via `getCloudflareContext()` inside `lib/cloudflare/*` only.

## Validation (Zod everywhere at boundaries)
- Env: `validators/env.ts` parses secrets/vars once per request via `getEnv()`; fail fast with a typed error.
- API inputs: every `route.ts` parses body/query/params with a Zod schema before calling a service.
- Webhooks: verify signature on the raw body FIRST, then `JSON.parse` → Zod. Never trust unverified payloads.
- JSON columns (`text(..., { mode: 'json' })`) use `.$type<T>()` where `T = z.infer<typeof schema>`; validate on write.

## Edge / Workers Compatibility
- Do NOT add `export const runtime = 'edge'` (unsupported by OpenNext; all routes run on Workers).
- Keep `src/middleware.ts` (edge). Do NOT migrate to Next 16 `proxy.ts`: Node-runtime proxy is experimental on OpenNext.
- Toolchain: Node ≥ 22.12 (wrangler 4.148+). `.npmrc` uses `legacy-peer-deps` (npm arborist bug) → install peers explicitly.
- Crypto: Web Crypto only (`crypto.subtle`, `crypto.getRandomValues`, `crypto.randomUUID`). Never import `node:crypto`.
- No `fs`, `path`, `child_process`, native modules, or Node-only SDKs. Prefer `fetch`-based clients.
- Read webhook bodies with `await request.text()` (raw bytes needed for HMAC).
- Use `ctx.waitUntil()` for non-critical side effects (emails, analytics) after responding.

## Database (D1 + Drizzle)
- Schema changes: edit `src/db/schema.ts` → `npx drizzle-kit generate` → review SQL in `/migrations`.
- **Local first, always:** `npx wrangler d1 migrations apply naif-mutfak-db --local` and test before remote.
- Remote apply (`--remote`) only after local verification and explicit user approval. Never `drizzle-kit push` to remote.
- Never edit an applied migration; add a new one. Money = integer minor units. Timestamps = `integer({ mode: 'timestamp' })`.
- Multi-statement writes use `db.batch([...])` (D1 has no interactive transactions).

## Storage (R2)
- `MEDIA_PUBLIC` bucket: image originals (`posts/{postId}/{uuid}.{ext}`), delivered optimized via custom domain + Image Transformations.
- Uploads: admin-only presigned PUT (S3 API + `aws4fetch`), keys server-generated, verified on finalize (admin.md).
- `EBOOKS_PRIVATE` bucket: paid PDFs. Never public, never listed, never linked directly. Delivery only per payments.md.

## i18n & RTL
- `next-intl` with `localePrefix: 'always'` → `/tr`, `/en`, `/ar`. `<html lang dir>` set from `i18n/config.ts` (`ar` → `rtl`).
- Logical CSS ONLY: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `rounded-s-*`.
  Banned: `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `border-l/r`, `rounded-l/r`.
- Directional icons (arrows, chevrons) use `rtl:-scale-x-100`. Numbers/prices via `Intl.NumberFormat(locale)`.
- Fonts switch by locale (Latin serif vs Arabic); see editorial-system.md.

## Payments (summary — details in payments.md)
- Merchant of Record: Lemon Squeezy or Paddle, selected by `PAYMENT_PROVIDER` env.
- HMAC-SHA256 verification via `crypto.subtle.verify` (constant-time). Idempotent order writes keyed on provider order id.
- PDFs delivered by short-lived signed tokens streamed through a Worker route.

## Security
- Secrets via `wrangler secret put` (remote) and `.dev.vars` (local, gitignored). Never commit secrets.
- No PII in URLs or logs. Log provider event ids, not emails or payloads.
- Escape JSON-LD (`<` → `<`) before injecting into `<script type="application/ld+json">`.

## Quality Gates (run before declaring done)
- `npm run typecheck` · `npm run lint` · `npm run test` (Vitest; services + validators must have tests).
- Lint enforces: no `any`, no physical-direction Tailwind classes, no `node:` imports in `src/`.

## Commands
- Dev: `npm run dev` (Next) · Workers preview: `npm run preview` (`opennextjs-cloudflare build && opennextjs-cloudflare preview`)
- Types: `npm run cf-typegen` · Migrations: `npm run db:generate`, `npm run db:migrate:local`
- Deploy: `npm run deploy` — only on explicit user request.
