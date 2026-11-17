// Admin auto-translation of a post (TR → EN/AR) with Workers AI. Writes an unpublished draft plus a check report;
// never publishes, never overwrites hand-written, hand-edited or live text without `overwrite`.
import type { TextModel } from '@/lib/cloudflare/ai';
import type { AdminPostsRepo, AdminTranslation } from '@/repositories/admin-posts';
import type { AdminIdentity } from '@/services/admin/auth.service';
import { SLUG_MAX, slugify } from '@/services/content/slug';
import { runChecks } from '@/services/translation/checks';
import { contentHash, describeTranslation, type TranslationStatus } from '@/services/translation/content-hash';
import { classifyAiError, extractModelText, parseModelJson, stripFence } from '@/services/translation/model-output';
import { mergePayload, toPayload } from '@/services/translation/payload';
import { bodyPrompt, payloadPrompt, reviewPrompt, splitBody } from '@/services/translation/prompts';
import { postTranslationInputSchema } from '@/validators/admin/post';
import {
  modelPayloadSchema,
  modelReviewSchema,
  type ModelPayload,
  type ReviewIssue,
  type TranslateInput,
  type TranslationCheck,
  type TranslationReport,
} from '@/validators/admin/translation';
import { pathsFor } from './posts-admin.service';

export interface PostTranslateDeps {
  posts: Pick<AdminPostsRepo, 'find' | 'isSlugTaken' | 'saveAiTranslation'>;
  model: TextModel;
  translateModel: string;
  reviewModel: string;
  now: () => Date;
}

export type TranslateError = 'not_found' | 'source_missing' | 'needs_confirm' | 'quota' | 'ai_unavailable' | 'model_output' | 'slug';

export type TranslateResult =
  | { ok: true; translation: AdminTranslation; status: TranslationStatus; revalidate: string[] }
  | { ok: false; error: TranslateError };

const TOKENS = { payload: 8_000, body: 8_000, review: 1_500 } as const;
const MAX_CHECKS = 50;
const MAX_REVIEW = 20;
const MAX_REVIEW_MESSAGE = 400;
const MAX_FIELD = 80;

/** Model step failure carried to the top level (never escapes `translatePost`). */
class StepError extends Error {
  constructor(readonly code: TranslateError) {
    super(code);
  }
}

async function call(deps: PostTranslateDeps, model: string, prompt: { system: string; user: string }, json: boolean, maxTokens: number) {
  try {
    return await deps.model({ model, system: prompt.system, user: prompt.user, json, maxTokens });
  } catch (err) {
    throw new StepError(classifyAiError(err));
  }
}

async function translatePayload(deps: PostTranslateDeps, input: TranslateInput, source: AdminTranslation): Promise<ModelPayload> {
  const prompt = payloadPrompt(input.locale, toPayload(source));
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = modelPayloadSchema.safeParse(parseModelJson(await call(deps, deps.translateModel, prompt, true, TOKENS.payload)));
    if (parsed.success) return parsed.data;
  }
  throw new StepError('model_output');
}

async function translateBody(deps: PostTranslateDeps, input: TranslateInput, bodyMd: string): Promise<string> {
  const out: string[] = [];
  for (const chunk of splitBody(bodyMd)) {
    const text = stripFence(extractModelText(await call(deps, deps.translateModel, bodyPrompt(input.locale, chunk), false, TOKENS.body)) ?? '').trim();
    if (!text) throw new StepError('model_output');
    out.push(text);
  }
  return out.join('\n\n');
}

async function pickSlug(deps: PostTranslateDeps, input: TranslateInput, title: string, source: AdminTranslation, existing?: AdminTranslation): Promise<string> {
  if (existing?.slug) return existing.slug;
  const base = slugify(title, input.locale) || `${source.slug}-${input.locale}`.slice(0, SLUG_MAX);
  for (let n = 1; n <= 9; n++) {
    const suffix = n === 1 ? '' : `-${n}`;
    const slug = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!(await deps.posts.isSlugTaken(input.locale, slug, input.postId))) return slug;
  }
  throw new StepError('slug');
}

/** AI review never blocks saving: any failure yields `reviewed: false`. */
async function review(deps: PostTranslateDeps, input: TranslateInput, source: AdminTranslation, translation: AdminTranslation, checks: TranslationCheck[]) {
  try {
    const raw = await deps.model({ model: deps.reviewModel, ...reviewPrompt(input.locale, source, translation, checks), json: true, maxTokens: TOKENS.review });
    const parsed = modelReviewSchema.safeParse(parseModelJson(raw));
    if (!parsed.success) return { review: [], reviewed: false };
    const issues: ReviewIssue[] = parsed.data.issues.slice(0, MAX_REVIEW).map((i) => ({
      severity: i.severity,
      field: i.field.slice(0, MAX_FIELD),
      message: i.message.slice(0, MAX_REVIEW_MESSAGE),
    }));
    return { review: issues, reviewed: true };
  } catch {
    return { review: [], reviewed: false };
  }
}

export async function translatePost(deps: PostTranslateDeps, actor: AdminIdentity, input: TranslateInput): Promise<TranslateResult> {
  const post = await deps.posts.find(input.postId);
  if (!post) return { ok: false, error: 'not_found' };
  const source = post.translations.find((t) => t.locale === 'tr');
  if (!source || !source.title.trim()) return { ok: false, error: 'source_missing' };
  const existing = post.translations.find((t) => t.locale === input.locale);

  const before = await describeTranslation(source, existing, post.aiMeta[input.locale]);
  const protectedText = existing && (before.origin === 'manual' || before.origin === 'ai_edited' || existing.isPublished);
  if (protectedText && !input.overwrite) return { ok: false, error: 'needs_confirm' };

  try {
    const payload = await translatePayload(deps, input, source);
    const bodyMd = await translateBody(deps, input, source.bodyMd);
    const merged = mergePayload(source, payload);
    const slug = await pickSlug(deps, input, merged.content.title, source, existing);

    const row = postTranslationInputSchema.safeParse({ ...merged.content, locale: input.locale, slug, bodyMd, isPublished: false });
    if (!row.success) return { ok: false, error: 'model_output' };
    const translation: AdminTranslation = row.data;

    const checks = [...merged.checks, ...runChecks(source, translation)].slice(0, MAX_CHECKS);
    const report: TranslationReport = { checks, ...(await review(deps, input, source, translation, checks)) };

    const saved = await deps.posts.saveAiTranslation({
      postId: input.postId,
      translation,
      meta: { sourceHash: await contentHash(source), contentHash: await contentHash(translation), report, translatedAt: deps.now() },
      audit: {
        actorEmail: actor.email,
        action: 'post.translate',
        entityType: 'post',
        entityId: input.postId,
        diff: { locale: input.locale, checks: checks.length, review: report.review.length, reviewed: report.reviewed, overwrite: input.overwrite },
      },
    });
    if (saved === 'slug_taken') return { ok: false, error: 'slug' };

    return {
      ok: true,
      translation,
      status: { origin: 'ai', outdated: false, report },
      revalidate: existing?.isPublished ? pathsFor(input.locale, existing.slug) : [],
    };
  } catch (err) {
    if (err instanceof StepError) return { ok: false, error: err.code };
    throw err;
  }
}
