'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { LOCALES, type Locale } from '@/i18n/config';
import {
  copyStructure,
  emptyTranslation,
  issueLocale,
  ruleInputs,
  startedTranslations,
  toSaveInput,
} from '@/services/admin/post-form';
import type { SavePostResult, SlugCheck } from '@/services/admin/posts-admin.service';
import { translationCompleteness, type AdminIssue, type Completeness, type StructureWarning } from '@/services/admin/post-rules';
import type { PostForm, SharedForm, TranslationForm } from '@/validators/admin/post-form';
import { DIFFICULTIES, POST_STATUSES } from '@/validators/admin/post';
import { CATEGORY_KEYS } from '@/services/content/category';
import { CheckboxField, SelectField, TextField } from './fields';
import { TranslationPane } from './TranslationPane';
import { UploadButton } from './UploadButton';
import { useStoredDraft } from './use-stored-draft';

interface PostEditorProps {
  postId: string;
  initialForm: PostForm;
  updatedAt: number;
  heroImageKey: string | null;
  heroImageUrl: string | null;
  mediaBaseUrl: string;
  siteUrl: string;
  products: { id: string; slug: string }[];
  /** Server Actions (passed from the page; components never import app/). */
  saveAction: (raw: unknown) => Promise<SavePostResult>;
  checkSlugAction: (raw: unknown) => Promise<SlugCheck>;
}

type Notice = { kind: 'saved' } | { kind: 'conflict' } | { kind: 'issues'; issues: AdminIssue[]; sent: Locale[] } | null;

const DOT: Record<Completeness, string> = { complete: '●', partial: '◐', empty: '○' };

export function PostEditor(props: PostEditorProps) {
  const t = useTranslations('Admin');
  const [form, setForm] = useState<PostForm>(props.initialForm);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(props.initialForm));
  const [updatedAt, setUpdatedAt] = useState(props.updatedAt);
  const [hero, setHero] = useState({ key: props.heroImageKey, url: props.heroImageUrl });
  const [view, setView] = useState<'tabs' | 'split'>('tabs');
  const [active, setActive] = useState<Locale>('tr');
  const [split, setSplit] = useState<[Locale, Locale]>(['tr', 'ar']);
  const [slugTouched, setSlugTouched] = useState<Partial<Record<Locale, boolean>>>(() => ({
    tr: Boolean(props.initialForm.translations.tr?.slug),
    en: Boolean(props.initialForm.translations.en?.slug),
    ar: Boolean(props.initialForm.translations.ar?.slug),
  }));
  const [slugStatus, setSlugStatus] = useState<Partial<Record<Locale, 'ok' | 'invalid' | 'taken'>>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [warnings, setWarnings] = useState<StructureWarning[]>([]);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const stored = useStoredDraft(props.postId);

  const dirty = JSON.stringify(form) !== savedJson;
  const completeness = useMemo(() => {
    const out: Record<Locale, Completeness> = { tr: 'empty', en: 'empty', ar: 'empty' };
    for (const l of LOCALES) {
      const tr = form.translations[l];
      if (!tr) continue;
      const { shared, translation } = ruleInputs(form, tr);
      out[l] = translationCompleteness(shared, translation, { heroImageKey: hero.key, mediaBaseUrl: props.mediaBaseUrl, siteUrl: props.siteUrl });
    }
    return out;
  }, [form, hero.key, props.mediaBaseUrl, props.siteUrl]);

  // Autosave unsaved edits; warn before leaving with unsaved changes.
  const { write } = stored;
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => write({ baseUpdatedAt: updatedAt, savedAt: Date.now(), form }), 800);
    return () => window.clearTimeout(id);
  }, [dirty, form, updatedAt, write]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const showRestore = !draftDismissed && !dirty && stored.draft !== null && JSON.stringify(stored.draft.form) !== savedJson;

  const setShared = <K extends keyof SharedForm>(key: K, v: SharedForm[K]) =>
    setForm((f) => ({ ...f, shared: { ...f.shared, [key]: v } }));
  const setTranslation = (l: Locale, v: TranslationForm | null) =>
    setForm((f) => ({ ...f, translations: { ...f.translations, [l]: v } }));

  // Field errors per locale from the last save attempt.
  const fieldErrors = useMemo(() => {
    const out: Record<Locale, Partial<Record<string, string>>> = { tr: {}, en: {}, ar: {} };
    if (notice?.kind !== 'issues') return out;
    for (const issue of notice.issues) {
      const l = issueLocale(issue.path, notice.sent);
      const field = issue.path.split('.')[2];
      if (l && field) out[l][field] = t(`issues.${issue.code}`, { path: issue.path });
    }
    return out;
  }, [notice, t]);

  function save(publish: boolean) {
    const next: PostForm = publish ? { ...form, shared: { ...form.shared, status: 'published' } } : form;
    if (publish) setForm(next);
    const sent = startedTranslations(next).map((tr) => tr.locale);
    startTransition(async () => {
      const result = await props.saveAction(toSaveInput(next, props.postId, updatedAt));
      if (result.ok) {
        setUpdatedAt(result.updatedAt);
        setSavedJson(JSON.stringify(next));
        setWarnings(result.warnings);
        setNotice({ kind: 'saved' });
        stored.clear();
      } else if (result.error === 'conflict') {
        setNotice({ kind: 'conflict' });
      } else if (result.error === 'invalid') {
        setNotice({ kind: 'issues', issues: result.issues, sent });
      } else {
        setNotice({ kind: 'issues', issues: [{ path: 'post', code: 'invalid' }], sent });
      }
    });
  }

  async function checkSlug(l: Locale) {
    const slug = form.translations[l]?.slug ?? '';
    const status = await props.checkSlugAction({ postId: props.postId, locale: l, slug });
    setSlugStatus((s) => ({ ...s, [l]: status }));
  }

  const pane = (l: Locale) => (
    <TranslationPane
      key={l}
      postId={props.postId}
      locale={l}
      value={form.translations[l]}
      isRecipe={form.shared.isRecipe}
      mediaBaseUrl={props.mediaBaseUrl}
      ebookSlugs={props.products.map((p) => p.slug)}
      fieldErrors={fieldErrors[l]}
      slugStatus={slugStatus[l] ?? null}
      slugTouched={slugTouched[l] ?? false}
      canCopyStructure={l !== 'tr' && (form.translations.tr?.ingredients.length ?? 0) + (form.translations.tr?.instructions.length ?? 0) > 0}
      onChange={(v) => setTranslation(l, v)}
      onStart={() => setTranslation(l, emptyTranslation(l))}
      onCopyStructure={() => {
        const source = form.translations.tr;
        const target = form.translations[l];
        if (source && target) setTranslation(l, copyStructure(source, target));
      }}
      onSlugEdited={() => {
        setSlugTouched((s) => ({ ...s, [l]: true }));
        setSlugStatus((s) => ({ ...s, [l]: undefined }));
      }}
      onSlugBlur={() => void checkSlug(l)}
    />
  );

  const generalIssues =
    notice?.kind === 'issues' ? notice.issues.filter((i) => !issueLocale(i.path, notice.sent) || !i.path.split('.')[2]) : [];
  const localeOptions = LOCALES.map((l) => ({ value: l, label: t(`locales.${l}`) }));

  return (
    <div className="mx-auto max-w-page">
      <header className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-cream/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <h1 className="font-display text-h3">{form.translations.tr?.title || form.translations.en?.title || t('posts.untitled')}</h1>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-eyebrow text-muted">
            {pending ? t('common.saving') : dirty ? '' : notice?.kind === 'saved' ? t('common.saved') : ''}
          </span>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending}
            className="rounded-pill border border-charcoal px-4 py-2 font-medium disabled:opacity-50"
          >
            {t('common.save')}
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={pending}
            className="rounded-pill bg-terracotta px-4 py-2 font-medium text-white hover:bg-terracotta-deep disabled:opacity-50"
          >
            {t('common.publish')}
          </button>
        </div>
      </header>

      {showRestore && stored.draft ? (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-card bg-butter/40 p-3">
          <span>{t('editor.restoreDraft')}</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              if (stored.draft) setForm(stored.draft.form);
              setDraftDismissed(true);
            }}
          >
            {t('editor.restore')}
          </button>
          <button
            type="button"
            className="text-stone underline"
            onClick={() => {
              stored.clear();
              setDraftDismissed(true);
            }}
          >
            {t('editor.discard')}
          </button>
        </div>
      ) : null}

      {notice?.kind === 'conflict' ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-danger bg-paper p-3 text-danger">
          <span>{t('editor.conflict')}</span>
          <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
            {t('common.reload')}
          </button>
        </div>
      ) : null}
      {notice?.kind === 'issues' ? (
        <div role="alert" className="mt-4 rounded-card border border-danger bg-paper p-3">
          <p className="font-medium text-danger">{t('editor.issuesTitle')}</p>
          <ul className="mt-1 list-disc ps-5 text-stone">
            {notice.issues.map((i) => {
              const l = issueLocale(i.path, notice.sent);
              const message = t(`issues.${i.code}`, { path: i.path });
              return <li key={`${i.path}:${i.code}`}>{l ? t('issues.inLocale', { locale: l.toUpperCase(), message }) : message}</li>;
            })}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div role="status" className="mt-4 rounded-card bg-butter/30 p-3">
          <p className="font-medium">{t('editor.warningsTitle')}</p>
          <ul className="mt-1 list-disc ps-5">
            {warnings.map((w) => (
              <li key={`${w.locale}:${w.kind}:${w.id ?? ''}`}>{t(`warnings.${w.kind}`, { locale: w.locale.toUpperCase(), id: w.id ?? '' })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-6 rounded-card border border-hairline bg-paper p-4 md:p-5" aria-labelledby="shared-heading">
        <h2 id="shared-heading" className="font-display text-h3">
          {t('editor.shared')}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label={t('editor.status')}
            value={form.shared.status}
            options={POST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            onChange={(v) => setShared('status', v)}
            error={generalIssues.some((i) => i.path === 'post.status') ? t('issues.status_needs_locale') : null}
          />
          <SelectField
            label={t('editor.category')}
            value={form.shared.category}
            options={CATEGORY_KEYS.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
            onChange={(v) => setShared('category', v)}
          />
          <SelectField
            label={t('editor.difficulty')}
            value={form.shared.difficulty}
            options={[{ value: '' as const, label: t('editor.difficultyNone') }, ...DIFFICULTIES.map((d) => ({ value: d, label: t(`editor.${d}`) }))]}
            onChange={(v) => setShared('difficulty', v)}
          />
          <SelectField
            label={t('editor.featuredEbook')}
            value={form.shared.featuredProductId}
            options={[{ value: '', label: t('editor.featuredNone') }, ...props.products.map((p) => ({ value: p.id, label: p.slug }))]}
            onChange={(v) => setShared('featuredProductId', v)}
          />
          <div className="flex items-end pb-2">
            <CheckboxField label={t('editor.isRecipe')} checked={form.shared.isRecipe} onChange={(v) => setShared('isRecipe', v)} />
          </div>
          {form.shared.isRecipe ? (
            <>
              <TextField label={t('editor.prep')} value={form.shared.prepMinutes} inputMode="numeric" onChange={(v) => setShared('prepMinutes', v)} />
              <TextField label={t('editor.cook')} value={form.shared.cookMinutes} inputMode="numeric" onChange={(v) => setShared('cookMinutes', v)} />
              <TextField label={t('editor.rest')} value={form.shared.restMinutes} inputMode="numeric" onChange={(v) => setShared('restMinutes', v)} />
              <TextField
                label={t('editor.servings')}
                value={form.shared.baseServings}
                inputMode="numeric"
                onChange={(v) => setShared('baseServings', v)}
                error={generalIssues.some((i) => i.code === 'publish_servings') ? t('issues.publish_servings') : null}
              />
            </>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {hero.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of the R2 original
            <img src={hero.url} alt="" className="h-24 w-36 rounded-card object-cover" />
          ) : (
            <span className="flex h-24 w-36 items-center justify-center rounded-card bg-linen text-eyebrow text-muted">{t('editor.noHeroImage')}</span>
          )}
          <div>
            <p className="font-medium">{t('editor.heroImage')}</p>
            <UploadButton
              kind="post_hero"
              entityId={props.postId}
              accept="image/jpeg,image/png,image/webp,image/avif"
              label={hero.key ? t('common.replace') : t('common.upload')}
              onUploaded={(key, url) => setHero({ key, url })}
            />
            {generalIssues.some((i) => i.code === 'publish_hero') ? <p className="mt-1 text-eyebrow text-danger">{t('issues.publish_hero')}</p> : null}
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div role="tablist" aria-label={t('editor.viewMode')} className="flex gap-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={view === 'tabs' && active === l}
              onClick={() => {
                setView('tabs');
                setActive(l);
              }}
              className={`rounded-t-card border border-b-0 border-hairline px-4 py-2 ${view === 'tabs' && active === l ? 'bg-paper font-medium' : 'bg-linen text-stone'}`}
            >
              {l.toUpperCase()}{' '}
              <span aria-label={t(`editor.completeness.${completeness[l]}`)} title={t(`editor.completeness.${completeness[l]}`)}>
                {DOT[completeness[l]]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label={t('editor.viewMode')}
            value={view}
            options={[
              { value: 'tabs', label: t('editor.viewTabs') },
              { value: 'split', label: t('editor.viewSideBySide') },
            ]}
            onChange={setView}
          />
          {view === 'split' ? (
            <>
              <SelectField label={t('editor.leftLocale')} value={split[0]} options={localeOptions} onChange={(v) => setSplit([v, split[1]])} />
              <SelectField label={t('editor.rightLocale')} value={split[1]} options={localeOptions} onChange={(v) => setSplit([split[0], v])} />
            </>
          ) : null}
        </div>
      </div>

      {view === 'tabs' ? (
        <div className="mt-2" role="tabpanel">
          {pane(active)}
        </div>
      ) : (
        <div className="mt-2 grid gap-4 lg:grid-cols-2">
          {pane(split[0])}
          {split[1] !== split[0] ? pane(split[1]) : null}
        </div>
      )}
    </div>
  );
}
