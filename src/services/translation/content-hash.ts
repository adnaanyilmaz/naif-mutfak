// Content hashes for auto-translation state: "hand-edited" (target changed since the AI wrote it) and
// "out of date" (Turkish source changed since translating). The projection is text-only and normalised,
// so an untouched translation keeps its hash through the editor's form round-trip.
import type { AdminTranslation, AiTranslationMeta } from '@/repositories/admin-posts';
import type { TranslationReport } from '@/validators/admin/translation';

export type HashableTranslation = Omit<AdminTranslation, 'locale' | 'slug' | 'isPublished'>;

const t = (v: string | null | undefined) => (v ?? '').trim();

export async function contentHash(tr: HashableTranslation): Promise<string> {
  const projection = [
    t(tr.title),
    t(tr.dek),
    t(tr.bodyMd),
    t(tr.heroImageAlt),
    t(tr.seoTitle),
    t(tr.seoDescription),
    t(tr.cuisine),
    tr.keywords.map(t),
    (tr.ingredients ?? []).map((g) => [t(g.title), g.items.map((i) => [i.id, t(i.name), t(i.unit), t(i.note)])]),
    (tr.instructions ?? []).map((s) => [t(s.title), s.steps.map((st) => [st.id, t(st.text)])]),
  ];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(projection)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type TranslationOrigin = 'none' | 'manual' | 'ai' | 'ai_edited';

export interface TranslationStatus {
  origin: TranslationOrigin;
  /** The Turkish source changed after this translation was generated. */
  outdated: boolean;
  report: TranslationReport | null;
}

export async function describeTranslation(
  source: AdminTranslation | undefined,
  target: AdminTranslation | undefined,
  meta: AiTranslationMeta | undefined,
): Promise<TranslationStatus> {
  if (!target) return { origin: 'none', outdated: false, report: null };
  if (!meta) return { origin: 'manual', outdated: false, report: null };
  const origin = (await contentHash(target)) === meta.contentHash ? 'ai' : 'ai_edited';
  const outdated = source ? (await contentHash(source)) !== meta.sourceHash : false;
  return { origin, outdated, report: meta.report };
}
