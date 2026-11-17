import { describe, expect, it } from 'vitest';
import type { TextModelRequest } from '@/lib/cloudflare/ai';
import type { AdminPostRecord, AdminTranslation, AiTranslationWrite } from '@/repositories/admin-posts';
import type { AdminIdentity } from '@/services/admin/auth.service';
import { slugify } from '@/services/content/slug';
import { contentHash } from '@/services/translation/content-hash';
import { enPayload, trSource } from '@/services/translation/fixtures';
import type { ModelPayload } from '@/validators/admin/translation';
import { translatePost, type PostTranslateDeps } from './post-translate.service';

const POST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin: AdminIdentity = { email: 'chef@naifmutfak.com', sub: 's', via: 'access' };
const QUOTA = new Error('3036: You have used up your daily free allocation of 10,000 neurons.');
const EN_BODY = '## Dough\n\nMix the flour with 500 g water.\n\n- Flour\n- Water';

function record(translations: AdminTranslation[], aiMeta: AdminPostRecord['aiMeta'] = {}): AdminPostRecord {
  return {
    id: POST,
    status: 'draft',
    category: 'ekmekler',
    heroImageKey: null,
    isRecipe: true,
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    baseServings: 4,
    difficulty: null,
    featuredProductId: null,
    publishedAt: null,
    updatedAt: new Date(0),
    translations,
    aiMeta,
  };
}

type Reply = unknown;
const json = (v: unknown): Reply => ({ choices: [{ message: { content: JSON.stringify(v) } }] });
const text = (v: string): Reply => ({ choices: [{ message: { content: v } }] });
const REVIEW_OK = json({ issues: [] });

function setup(post: AdminPostRecord | null, replies: (Reply | Error)[], opts: { taken?: string[]; outcome?: 'saved' | 'slug_taken' } = {}) {
  const calls: TextModelRequest[] = [];
  const writes: AiTranslationWrite[] = [];
  const deps: PostTranslateDeps = {
    posts: {
      find: async (id) => (post && id === post.id ? post : null),
      isSlugTaken: async (_l, slug) => (opts.taken ?? []).includes(slug),
      saveAiTranslation: async (w) => {
        writes.push(w);
        return opts.outcome ?? 'saved';
      },
    },
    model: async (req) => {
      calls.push(req);
      const next = replies.shift();
      if (next instanceof Error) throw next;
      if (next === undefined) throw new Error('unexpected model call');
      return next;
    },
    translateModel: '@cf/translate',
    reviewModel: '@cf/review',
    now: () => new Date('2026-11-17T00:00:00Z'),
  };
  return { deps, calls, writes };
}

const run = (deps: PostTranslateDeps, locale: 'en' | 'ar' = 'en', overwrite = false) => translatePost(deps, admin, { postId: POST, locale, overwrite });
const happy = (p: Partial<ModelPayload> = {}): (Reply | Error)[] => [json(enPayload(p)), text(EN_BODY), REVIEW_OK];

describe('translatePost', () => {
  it('translates to an unpublished draft with source numbers and a generated slug', async () => {
    const { deps, calls, writes } = setup(record([trSource]), happy());
    const result = await run(deps);
    expect(result.ok).toBe(true);
    expect(calls.map((c) => [c.model, c.json])).toEqual([
      ['@cf/translate', true],
      ['@cf/translate', false],
      ['@cf/review', true],
    ]);
    const saved = writes[0]?.translation;
    expect(saved).toMatchObject({ locale: 'en', isPublished: false, slug: slugify('Sourdough Bread', 'en'), bodyMd: EN_BODY });
    expect(saved?.ingredients?.[0]?.items.map((i) => i.quantity)).toEqual([500, 10]);
    expect(writes[0]?.meta.sourceHash).toBe(await contentHash(trSource));
    expect(writes[0]?.meta.contentHash).toBe(saved ? await contentHash(saved) : '');
    const diff = JSON.stringify(writes[0]?.audit.diff);
    expect(diff).not.toContain('Sourdough');
    expect(writes[0]?.audit.action).toBe('post.translate');
    if (result.ok) expect(result.status).toEqual({ origin: 'ai', outdated: false, report: { checks: [], review: [], reviewed: true } });
  });

  it('skips the body call for a blank Turkish body', async () => {
    const { deps, calls } = setup(record([{ ...trSource, bodyMd: '' }]), [json(enPayload()), REVIEW_OK]);
    expect((await run(deps)).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('needs a Turkish source', async () => {
    const { deps, calls } = setup(record([]), []);
    expect(await run(deps)).toEqual({ ok: false, error: 'source_missing' });
    expect(calls).toHaveLength(0);
    expect(await run(setup(null, []).deps)).toEqual({ ok: false, error: 'not_found' });
  });

  it('asks before replacing a hand-written translation', async () => {
    const manual: AdminTranslation = { ...trSource, locale: 'en', slug: 'my-bread', title: 'My bread', isPublished: false };
    const blocked = setup(record([trSource, manual]), []);
    expect(await run(blocked.deps)).toEqual({ ok: false, error: 'needs_confirm' });
    expect(blocked.calls).toHaveLength(0);
    expect(blocked.writes).toHaveLength(0);
    const allowed = setup(record([trSource, manual]), happy());
    expect((await run(allowed.deps, 'en', true)).ok).toBe(true);
    expect(allowed.writes[0]?.translation.slug).toBe('my-bread');
  });

  it('unpublishes a live AI translation only with overwrite, and revalidates its page', async () => {
    const live: AdminTranslation = { ...trSource, locale: 'en', slug: 'old-bread', title: 'Old bread', isPublished: true };
    const meta = { sourceHash: 'x', contentHash: await contentHash(live), report: { checks: [], review: [], reviewed: true }, translatedAt: new Date(0) };
    expect(await run(setup(record([trSource, live], { en: meta }), []).deps)).toEqual({ ok: false, error: 'needs_confirm' });
    const { deps, writes } = setup(record([trSource, live], { en: meta }), happy());
    const result = await run(deps, 'en', true);
    expect(writes[0]?.translation).toMatchObject({ isPublished: false, slug: 'old-bread' });
    expect(result.ok && result.revalidate).toContain('/en/blog/old-bread');
  });

  it('retries unusable JSON once, then gives up without writing', async () => {
    const twice = setup(record([trSource]), [text('not json'), text('still not json')]);
    expect(await run(twice.deps)).toEqual({ ok: false, error: 'model_output' });
    expect(twice.writes).toHaveLength(0);
    const once = setup(record([trSource]), [text('not json'), ...happy()]);
    expect((await run(once.deps)).ok).toBe(true);
  });

  it('reports the daily quota and writes nothing when translation fails', async () => {
    const { deps, writes } = setup(record([trSource]), [QUOTA]);
    expect(await run(deps)).toEqual({ ok: false, error: 'quota' });
    expect(writes).toHaveLength(0);
  });

  it('still saves when only the review fails', async () => {
    const { deps, writes } = setup(record([trSource]), [json(enPayload()), text(EN_BODY), QUOTA]);
    const result = await run(deps);
    expect(result.ok && result.status.report?.reviewed).toBe(false);
    expect(writes).toHaveLength(1);
  });

  it('stores review issues clamped to the report limits', async () => {
    const issues = Array.from({ length: 30 }, () => ({ severity: 'warning', field: 'title', message: 'm'.repeat(900) }));
    const { deps } = setup(record([trSource]), [json(enPayload()), text(EN_BODY), json({ issues })]);
    const result = await run(deps);
    const review = result.ok ? (result.status.report?.review ?? []) : [];
    expect(review).toHaveLength(20);
    expect(review[0]?.message.length).toBeLessThanOrEqual(400);
  });

  it('falls back and suffixes slugs for Arabic titles', async () => {
    const replies = () => [json(enPayload({ title: '!!!' })), text('## عجين\n\nاخلط ٥٠٠ غ.\n\n- دقيق\n- ماء'), REVIEW_OK];
    const ok = setup(record([trSource]), replies(), { taken: ['eksi-mayali-ekmek-ar', 'eksi-mayali-ekmek-ar-2'] });
    await run(ok.deps, 'ar');
    expect(ok.writes[0]?.translation.slug).toBe('eksi-mayali-ekmek-ar-3');
    const taken = ['', ...Array.from({ length: 8 }, (_, i) => `-${i + 2}`)].map((s) => `eksi-mayali-ekmek-ar${s}`);
    const none = setup(record([trSource]), replies(), { taken });
    expect(await run(none.deps, 'ar')).toEqual({ ok: false, error: 'slug' });
  });

  it('saves but reports a changed number', async () => {
    const steps = [{ id: 's1', text: 'Bake at 180°C for 20 minutes.' }, { id: 's2', text: 'Leave to cool.' }];
    const { deps, writes } = setup(record([trSource]), happy({ steps }));
    const result = await run(deps);
    expect(writes).toHaveLength(1);
    expect(result.ok && result.status.report?.checks).toContainEqual({ code: 'numbers', field: 'steps.s1' });
  });
});
