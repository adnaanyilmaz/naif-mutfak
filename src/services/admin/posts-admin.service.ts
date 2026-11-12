// Admin content editing (admin.md §2): optimistic concurrency, per-locale publish rules, audit, revalidation paths.
import type { AdminPostRecord, AdminPostsRepo, AdminTranslation } from '@/repositories/admin-posts';
import { mediaUrl } from '@/services/media/image-url';
import { isValidSlug } from '@/services/content/slug';
import type { AdminIdentity } from '@/services/admin/auth.service';
import type { SavePostInput } from '@/validators/admin/post';
import type { Locale } from '@/validators/content';
import {
  diffStructure,
  publishIssues,
  translationCompleteness,
  type AdminIssue,
  type Completeness,
  type StructureWarning,
} from './post-rules';

export interface AdminPostsDeps {
  posts: AdminPostsRepo;
  siteUrl: string;
  mediaBaseUrl: string;
  now: () => Date;
  newId: () => string;
}

export type SavePostResult =
  | { ok: true; updatedAt: number; warnings: StructureWarning[]; revalidate: string[] }
  | { ok: false; error: 'not_found' | 'conflict' }
  | { ok: false; error: 'invalid'; issues: AdminIssue[] };

const toSeconds = (d: Date) => Math.floor(d.getTime() / 1000);

function pathsFor(locale: Locale, slug: string): string[] {
  return [`/${locale}`, `/${locale}/blog`, `/${locale}/blog/${slug}`];
}

export async function savePost(deps: AdminPostsDeps, actor: AdminIdentity, input: SavePostInput): Promise<SavePostResult> {
  const existing = await deps.posts.find(input.postId);
  if (!existing) return { ok: false, error: 'not_found' };

  const ctx = { heroImageKey: existing.heroImageKey, mediaBaseUrl: deps.mediaBaseUrl, siteUrl: deps.siteUrl };
  const issues: AdminIssue[] = input.translations
    .filter((t) => t.isPublished)
    .flatMap((t) => publishIssues(input.post, t, ctx));
  if (input.post.status === 'published' && !input.translations.some((t) => t.isPublished)) {
    issues.push({ path: 'post.status', code: 'status_needs_locale' });
  }
  for (const t of input.translations) {
    if (await deps.posts.isSlugTaken(t.locale, t.slug, input.postId)) {
      issues.push({ path: `translations.${t.locale}.slug`, code: 'slug_taken' });
    }
  }
  if (issues.length > 0) return { ok: false, error: 'invalid', issues: dedupe(issues) };

  const now = deps.now();
  const expected = new Date(input.expectedUpdatedAt * 1000);
  // Strictly increasing token even for two saves within the same second.
  const next = new Date(Math.max(toSeconds(now), input.expectedUpdatedAt + 1) * 1000);
  const translations: AdminTranslation[] = input.translations;

  const outcome = await deps.posts.save({
    postId: input.postId,
    expectedUpdatedAt: expected,
    nextUpdatedAt: next,
    publishAt: input.post.status === 'published' ? now : null,
    post: input.post,
    translations,
    audit: {
      actorEmail: actor.email,
      action: 'post.save',
      entityType: 'post',
      entityId: input.postId,
      diff: changedFields(existing, input),
    },
  });
  if (outcome === 'conflict') return { ok: false, error: 'conflict' };
  if (outcome === 'slug_taken') return { ok: false, error: 'invalid', issues: [{ path: 'translations', code: 'slug_taken' }] };

  const revalidate = new Set<string>();
  for (const t of [...existing.translations, ...input.translations]) pathsFor(t.locale, t.slug).forEach((p) => revalidate.add(p));
  return { ok: true, updatedAt: toSeconds(next), warnings: diffStructure(input.translations), revalidate: [...revalidate] };
}

function dedupe(issues: AdminIssue[]): AdminIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.path}:${i.code}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Minimal audit diff: names of changed shared fields and touched locales (never bodies). */
const SHARED_KEYS = [
  'status', 'category', 'isRecipe', 'prepMinutes', 'cookMinutes', 'restMinutes', 'baseServings', 'difficulty', 'featuredProductId',
] as const satisfies readonly (keyof SavePostInput['post'])[];

const TRANSLATION_KEYS = [
  'slug', 'title', 'dek', 'bodyMd', 'heroImageAlt', 'seoTitle', 'seoDescription', 'ingredients', 'instructions', 'keywords', 'cuisine', 'isPublished',
] as const satisfies readonly (keyof AdminTranslation)[];

function changedFields(existing: AdminPostRecord, input: SavePostInput): Record<string, unknown> {
  const shared = SHARED_KEYS.filter((k) => existing[k] !== input.post[k]);
  const locales = input.translations.map((t) => {
    const before = existing.translations.find((e) => e.locale === t.locale);
    if (!before) return { locale: t.locale, created: true };
    return { locale: t.locale, fields: TRANSLATION_KEYS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(t[k])) };
  });
  return { shared, locales };
}

export async function createDraftPost(deps: AdminPostsDeps, actor: AdminIdentity): Promise<string> {
  const id = deps.newId();
  await deps.posts.createDraft(
    { id, category: 'bread' },
    { actorEmail: actor.email, action: 'post.create', entityType: 'post', entityId: id, diff: null },
  );
  return id;
}

export type SlugCheck = 'ok' | 'invalid' | 'taken';

export async function checkSlug(deps: AdminPostsDeps, postId: string, locale: Locale, slug: string): Promise<SlugCheck> {
  if (!isValidSlug(slug)) return 'invalid';
  return (await deps.posts.isSlugTaken(locale, slug, postId)) ? 'taken' : 'ok';
}

export interface AdminPostListView {
  id: string;
  status: AdminPostRecord['status'];
  category: string;
  updatedAt: Date;
  title: string;
  locales: { locale: Locale; isPublished: boolean }[];
}

export async function listAdminPosts(deps: AdminPostsDeps): Promise<AdminPostListView[]> {
  const rows = await deps.posts.list();
  return rows.map((p) => {
    const primary = p.translations.find((t) => t.locale === 'tr') ?? p.translations[0];
    return {
      id: p.id,
      status: p.status,
      category: p.category,
      updatedAt: p.updatedAt,
      title: primary?.title ?? '',
      locales: p.translations.map((t) => ({ locale: t.locale, isPublished: t.isPublished })),
    };
  });
}

export interface AdminPostEditView {
  post: AdminPostRecord;
  updatedAtSeconds: number;
  heroImageUrl: string | null;
  completeness: Record<Locale, Completeness>;
}

export async function getPostForEdit(deps: AdminPostsDeps, id: string): Promise<AdminPostEditView | null> {
  const post = await deps.posts.find(id);
  if (!post) return null;
  const ctx = { heroImageKey: post.heroImageKey, mediaBaseUrl: deps.mediaBaseUrl, siteUrl: deps.siteUrl };
  const at = (l: Locale) => translationCompleteness(post, post.translations.find((t) => t.locale === l), ctx);
  return {
    post,
    updatedAtSeconds: toSeconds(post.updatedAt),
    heroImageUrl: post.heroImageKey ? mediaUrl(deps.mediaBaseUrl, post.heroImageKey) : null,
    completeness: { tr: at('tr'), en: at('en'), ar: at('ar') },
  };
}
