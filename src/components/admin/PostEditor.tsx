'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
import { AdminCard, StatusBadge, accentButton, primaryButton, secondaryButton } from './AdminPage';
import { CheckboxField, SelectField, TextField } from './fields';
import { AlertIcon, BackIcon, CheckIcon, ExternalIcon, ImageIcon } from './icons';
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
  /** Public URL of the live post (null while unpublished). */
  publicPath: string | null;
}

type Notice = { kind: 'saved' } | { kind: 'conflict' } | { kind: 'issues'; issues: AdminIssue[]; sent: Locale[] } | null;

const DOT_COLOR: Record<Completeness, string> = { complete: 'bg-olive', partial: 'bg-brand', empty: 'bg-hairline' };

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
  const [toast, setToast] = useState(false);
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
        setToast(true);
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

  // Ctrl/Cmd + S saves; the listener always calls the latest save().
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(false), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

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
  const title = form.translations.tr?.title || form.translations.en?.title || form.translations.ar?.title || t('posts.untitled');
  const goToLocale = (l: Locale) => {
    setView('tabs');
    setActive(l);
    document.getElementById('content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto max-w-wide">
      {/* Sticky action bar */}
      <header className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-linen/90 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="mx-auto flex max-w-wide flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/posts" className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-charcoal">
              <BackIcon className="size-4 rtl:-scale-x-100" />
              {t('editor.back')}
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-display text-[1.25rem] font-extrabold">{title}</h1>
              <StatusBadge status={form.shared.status} label={t(`status.${form.shared.status}`)} />
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-wrap">
            <span aria-live="polite" className="hidden items-center gap-1.5 text-[0.8125rem] text-muted sm:inline-flex" title={t('editor.shortcut')}>
              {pending ? (
                t('common.saving')
              ) : dirty ? (
                <>
                  <span aria-hidden className="size-2 rounded-full bg-brand" />
                  {t('editor.unsaved')}
                </>
              ) : (
                <>
                  <CheckIcon className="size-4 text-olive" />
                  {t('editor.allSaved')}
                </>
              )}
            </span>
            {props.publicPath ? (
              <Link href={props.publicPath} target="_blank" rel="noopener" aria-label={t('editor.viewOnSite')} className={`${secondaryButton} max-sm:px-3`}>
                <span className="max-sm:hidden">{t('editor.viewOnSite')}</span>
                <ExternalIcon className="size-4" />
              </Link>
            ) : null}
            <button type="button" onClick={() => save(false)} disabled={pending || !dirty} className={`${secondaryButton} max-sm:flex-1 max-sm:justify-center`}>
              {t('common.save')}
            </button>
            <button type="button" onClick={() => save(true)} disabled={pending} className={`${accentButton} max-sm:flex-1 max-sm:justify-center`}>
              {t('common.publish')}
            </button>
          </div>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        {showRestore && stored.draft ? (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f3d48a] bg-[#fff8e6] px-4 py-3">
            <span className="flex-1">{t('editor.restoreDraft')}</span>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                stored.clear();
                setDraftDismissed(true);
              }}
            >
              {t('editor.discard')}
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                if (stored.draft) setForm(stored.draft.form);
                setDraftDismissed(true);
              }}
            >
              {t('editor.restore')}
            </button>
          </div>
        ) : null}

        {notice?.kind === 'conflict' ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f5c2bd] bg-[#fdecea] px-4 py-3 text-danger">
            <AlertIcon className="size-5" />
            <span className="flex-1">{t('editor.conflict')}</span>
            <button type="button" className="font-semibold underline underline-offset-4" onClick={() => window.location.reload()}>
              {t('common.reload')}
            </button>
          </div>
        ) : null}

        {notice?.kind === 'issues' ? (
          <div role="alert" className="rounded-2xl border border-[#f5c2bd] bg-white p-4">
            <p className="flex items-center gap-2 font-semibold text-danger">
              <AlertIcon className="size-5" />
              {t('editor.issuesTitle')}
            </p>
            <ul className="mt-2 space-y-1">
              {notice.issues.map((i) => {
                const l = issueLocale(i.path, notice.sent);
                const message = t(`issues.${i.code}`, { path: i.path });
                return (
                  <li key={`${i.path}:${i.code}`}>
                    {l ? (
                      <button
                        type="button"
                        onClick={() => goToLocale(l)}
                        title={t('editor.issueGoTo')}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-start text-stone hover:bg-linen"
                      >
                        <span className="rounded-md bg-linen px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase">{l}</span>
                        {message}
                      </button>
                    ) : (
                      <span className="block px-2 py-1 text-stone">{message}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div role="status" className="rounded-2xl border border-[#f3d48a] bg-[#fff8e6] p-4">
            <p className="font-semibold">{t('editor.warningsTitle')}</p>
            <ul className="mt-1 list-disc ps-5 text-stone">
              {warnings.map((w) => (
                <li key={`${w.locale}:${w.kind}:${w.id ?? ''}`}>{t(`warnings.${w.kind}`, { locale: w.locale.toUpperCase(), id: w.id ?? '' })}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <AdminCard id="general" title={t('editor.sectionGeneral')} hint={t('editor.sectionGeneralHint')}>
            <div className="grid gap-4 sm:grid-cols-2">
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
                label={t('editor.featuredEbook')}
                value={form.shared.featuredProductId}
                options={[{ value: '', label: t('editor.featuredNone') }, ...props.products.map((p) => ({ value: p.id, label: p.slug }))]}
                onChange={(v) => setShared('featuredProductId', v)}
              />
              <div className="flex items-end pb-2.5">
                <CheckboxField label={t('editor.isRecipe')} checked={form.shared.isRecipe} onChange={(v) => setShared('isRecipe', v)} />
              </div>
            </div>
          </AdminCard>

          <AdminCard id="media" title={t('editor.sectionMedia')} hint={t('editor.sectionMediaHint')}>
            <div className="flex flex-col gap-3">
              {hero.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of the R2 original
                <img src={hero.url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
              ) : (
                <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-linen text-[0.8125rem] text-muted">
                  <ImageIcon className="size-7" />
                  {t('editor.noHeroImage')}
                </span>
              )}
              <UploadButton
                kind="post_hero"
                entityId={props.postId}
                accept="image/jpeg,image/png,image/webp,image/avif"
                label={hero.key ? t('common.replace') : t('common.upload')}
                onUploaded={(key, url) => setHero({ key, url })}
              />
              {generalIssues.some((i) => i.code === 'publish_hero') ? <p className="text-[0.8125rem] text-danger">{t('issues.publish_hero')}</p> : null}
            </div>
          </AdminCard>
        </div>

        {form.shared.isRecipe ? (
          <AdminCard id="recipe" title={t('editor.sectionRecipe')} hint={t('editor.sectionRecipeHint')}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <SelectField
                label={t('editor.difficulty')}
                value={form.shared.difficulty}
                options={[{ value: '' as const, label: t('editor.difficultyNone') }, ...DIFFICULTIES.map((d) => ({ value: d, label: t(`editor.${d}`) }))]}
                onChange={(v) => setShared('difficulty', v)}
              />
            </div>
          </AdminCard>
        ) : null}

        <AdminCard id="content" title={t('editor.sectionContent')} hint={t('editor.sectionContentHint')} className="scroll-mt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div role="tablist" aria-label={t('editor.sectionContent')} className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-pill bg-linen p-1">
              {LOCALES.map((l) => {
                const selected = view === 'tabs' && active === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setView('tabs');
                      setActive(l);
                    }}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-pill px-4 py-1.5 text-[0.875rem] md:min-h-0 font-semibold whitespace-nowrap ${
                      selected ? 'bg-white text-charcoal shadow-[0_1px_3px_rgb(0_0_0/0.1)]' : 'text-stone hover:text-charcoal'
                    }`}
                  >
                    <span
                      aria-label={t(`editor.completeness.${completeness[l]}`)}
                      title={t(`editor.completeness.${completeness[l]}`)}
                      className={`size-2 rounded-full ${DOT_COLOR[completeness[l]]}`}
                    />
                    {t(`locales.${l}`)}
                  </button>
                );
              })}
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
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted">
            {(['complete', 'partial', 'empty'] as const).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={`size-2 rounded-full ${DOT_COLOR[c]}`} />
                {t(`editor.completeness.${c}`)}
              </span>
            ))}
          </p>

          <div className="mt-5">
            {view === 'tabs' ? (
              <div role="tabpanel">{pane(active)}</div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {pane(split[0])}
                {split[1] !== split[0] ? pane(split[1]) : null}
              </div>
            )}
          </div>
        </AdminCard>
      </div>

      {toast ? (
        <div role="status" className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <p className="inline-flex items-center gap-2 rounded-pill bg-charcoal px-5 py-3 text-[0.9375rem] font-medium text-white shadow-lift">
            <CheckIcon className="size-5 text-[#a3e635]" />
            {t('editor.savedToast')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
