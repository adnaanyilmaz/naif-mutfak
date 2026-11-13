'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { LOCALE_META } from '@/i18n/config';
import type { AdminProductEditView, ProductIssue, SaveProductResult } from '@/services/admin/products-admin.service';
import { PRODUCT_STATUSES } from '@/validators/admin/product';
import { LOCALES, type Locale } from '@/validators/content';
import Link from 'next/link';
import { AdminCard, StatusBadge, accentButton, primaryButton, secondaryButton } from './AdminPage';
import { CheckboxField, SelectField, TextField } from './fields';
import { AlertIcon, BackIcon, CheckIcon, ExternalIcon, ImageIcon } from './icons';
import { MarkdownField } from './MarkdownField';
import { UploadButton } from './UploadButton';

interface ProductEditorProps {
  view: AdminProductEditView;
  saveAction: (raw: unknown) => Promise<SaveProductResult>;
}

interface TranslationState {
  title: string;
  subtitle: string;
  descriptionMd: string;
  coverAlt: string;
}

interface VariantState {
  id: string | null;
  contentLocale: Locale;
  sku: string;
  priceTry: string;
  priceUsd: string;
  priceSar: string;
  lsVariantId: string;
  paddlePriceId: string;
  isActive: boolean;
  pdf: { key: string; size: number | null; sha: string | null } | null;
}

const blankTranslation: TranslationState = { title: '', subtitle: '', descriptionMd: '', coverAlt: '' };

export function ProductEditor({ view, saveAction }: ProductEditorProps) {
  const t = useTranslations('Admin');
  const format = useFormatter();
  const [product, setProduct] = useState({
    slug: view.product.slug,
    status: view.product.status,
    pageCount: view.product.pageCount === null ? '' : String(view.product.pageCount),
  });
  const [translations, setTranslations] = useState<Record<Locale, TranslationState | null>>(() => {
    const find = (l: Locale): TranslationState | null => {
      const tr = view.product.translations.find((x) => x.locale === l);
      return tr ? { title: tr.title, subtitle: tr.subtitle ?? '', descriptionMd: tr.descriptionMd, coverAlt: tr.coverAlt ?? '' } : null;
    };
    return { tr: find('tr'), en: find('en'), ar: find('ar') };
  });
  const [variants, setVariants] = useState<VariantState[]>(() =>
    view.variants.map((v) => ({
      id: v.id,
      contentLocale: v.contentLocale,
      sku: v.sku,
      priceTry: v.priceTry,
      priceUsd: v.priceUsd,
      priceSar: v.priceSar,
      lsVariantId: v.lsVariantId ?? '',
      paddlePriceId: v.paddlePriceId ?? '',
      isActive: v.isActive,
      pdf: v.pdfR2Key ? { key: v.pdfR2Key, size: v.pdfSizeBytes, sha: v.pdfSha256 } : null,
    })),
  );
  const [active, setActive] = useState<Locale>('tr');
  const [cover, setCover] = useState(view.coverImageUrl);
  const [issues, setIssues] = useState<ProductIssue[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'conflict'>('idle');
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const touch = () => {
    setDirty(true);
    setStatus('idle');
  };
  const setVariant = (i: number, patch: Partial<VariantState>) => {
    touch();
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  };
  const tr = translations[active];
  const meta = LOCALE_META[active];

  function save(statusOverride?: (typeof PRODUCT_STATUSES)[number]) {
    const status = statusOverride ?? product.status;
    if (statusOverride) setProduct((p) => ({ ...p, status: statusOverride }));
    const payload = {
      productId: view.product.id,
      expectedUpdatedAt: view.updatedAtSeconds,
      product: { slug: product.slug, status, pageCount: product.pageCount.trim() === '' ? null : Number(product.pageCount) },
      translations: LOCALES.flatMap((l) => {
        const x = translations[l];
        return x && x.title.trim() ? [{ locale: l, ...x }] : [];
      }),
      variants: variants.map(({ pdf: _pdf, ...v }) => v),
    };
    startTransition(async () => {
      const result = await saveAction(payload);
      // A failed publish leaves the product as it was.
      if (!result.ok && statusOverride) setProduct((p) => ({ ...p, status: view.product.status }));
      if (result.ok) {
        setIssues(null);
        setDirty(false);
        setStatus('saved');
        // The page re-renders with fresh ids/updatedAt (revalidatePath) and remounts this editor.
      } else if (result.error === 'conflict') {
        setStatus('conflict');
      } else if (result.error === 'invalid') {
        setIssues(result.issues);
      } else {
        setIssues([{ path: 'product', code: 'invalid' }]);
      }
    });
  }

  const morField = view.provider === 'lemonsqueezy' ? 'lsVariantId' : 'paddlePriceId';
  const activationNeeds = (v: VariantState): string[] => [
    ...(v.pdf ? [] : [t('productEditor.needPdf')]),
    ...(v[morField].trim() ? [] : [t('productEditor.needMorId', { field: t(`productEditor.${morField}`) })]),
  ];

  // The store lists a product only when the product itself is active AND it has an edition on sale.
  const canPublish = product.status !== 'active' && variants.some((v) => v.isActive);

  const missingEditions = LOCALES.filter((l) => !variants.some((v) => v.contentLocale === l));

  return (
    <div className="mx-auto max-w-wide">
      <header className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-linen/90 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="mx-auto flex max-w-wide flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/products" className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-charcoal">
              <BackIcon className="size-4 rtl:-scale-x-100" />
              {t('productEditor.back')}
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-display text-[1.25rem] font-extrabold">{translations.tr?.title || product.slug}</h1>
              <StatusBadge status={product.status} label={t(`status.${product.status}`)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-live="polite" className="hidden items-center gap-1.5 text-[0.8125rem] text-muted sm:inline-flex">
              {pending ? (
                t('common.saving')
              ) : dirty ? (
                <>
                  <span aria-hidden className="size-2 rounded-full bg-brand" />
                  {t('editor.unsaved')}
                </>
              ) : status === 'saved' ? (
                <>
                  <CheckIcon className="size-4 text-olive" />
                  {t('editor.allSaved')}
                </>
              ) : null}
            </span>
            {view.product.status === 'active' ? (
              <Link href={`/tr/ebooks/${view.product.slug}`} target="_blank" rel="noopener" className={secondaryButton}>
                {t('productEditor.viewOnSite')}
                <ExternalIcon className="size-4" />
              </Link>
            ) : null}
            <button type="button" onClick={() => save()} disabled={pending} className={canPublish ? secondaryButton : accentButton}>
              {t('common.save')}
            </button>
            {canPublish ? (
              <button type="button" onClick={() => save('active')} disabled={pending} className={accentButton}>
                {t('productEditor.publish')}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-6 space-y-6">
      {product.status !== 'active' ? (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-hairline bg-white px-4 py-3">
          <AlertIcon className="mt-0.5 size-5 text-brand" />
          <div className="flex-1 text-[0.9375rem]">
            <p className="font-semibold">{t('productEditor.notListedTitle')}</p>
            <p className="text-stone">
              {canPublish ? t('productEditor.notListedReady') : t('productEditor.notListedNeedsEdition')}
              {product.slug.startsWith('draft-') ? ` ${t('productEditor.slugHint')}` : ''}
            </p>
          </div>
        </div>
      ) : null}
      {status === 'conflict' ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f5c2bd] bg-[#fdecea] px-4 py-3 text-danger">
          <AlertIcon className="size-5" />
          <span className="flex-1">{t('editor.conflict')}</span>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => window.location.reload()}>
            {t('common.reload')}
          </button>
        </div>
      ) : null}
      {issues ? (
        <div role="alert" className="rounded-2xl border border-[#f5c2bd] bg-white p-4">
          <p className="flex items-center gap-2 font-semibold text-danger">
            <AlertIcon className="size-5" />
            {t('editor.issuesTitle')}
          </p>
          <ul className="mt-2 list-disc ps-6 text-stone">
            {issues.map((i) => (
              <li key={`${i.path}:${i.code}`}>
                {/^variants\.(tr|en|ar)/.test(i.path)
                  ? t('issues.inLocale', { locale: i.path.slice(9, 11).toUpperCase(), message: t(`issues.${i.code}`, { path: i.path }) })
                  : t(`issues.${i.code}`, { path: i.path })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <AdminCard title={t('productEditor.sectionGeneral')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={t('productEditor.slug')}
              value={product.slug}
              dir="ltr"
              hint={`/tr/ebooks/${product.slug}`}
              onChange={(slug) => {
                touch();
                setProduct((p) => ({ ...p, slug }));
              }}
            />
            <SelectField
              label={t('productEditor.status')}
              value={product.status}
              options={PRODUCT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
              onChange={(s) => {
                touch();
                setProduct((p) => ({ ...p, status: s }));
              }}
            />
            <TextField
              label={t('productEditor.pageCount')}
              value={product.pageCount}
              inputMode="numeric"
              onChange={(pageCount) => {
                touch();
                setProduct((p) => ({ ...p, pageCount }));
              }}
            />
          </div>
        </AdminCard>
        <AdminCard title={t('productEditor.cover')}>
          <div className="flex items-start gap-4 lg:flex-col">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of the R2 original
              <img src={cover} alt="" className="aspect-[3/4] w-28 rounded-xl object-cover shadow-card" />
            ) : (
              <span className="flex aspect-[3/4] w-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-linen text-center text-[0.75rem] text-muted">
                <ImageIcon className="size-6" />
                {t('productEditor.noCover')}
              </span>
            )}
            <UploadButton
              kind="product_cover"
              entityId={view.product.id}
              accept="image/jpeg,image/png,image/webp"
              label={cover ? t('common.replace') : t('common.upload')}
              onUploaded={(_key, url) => setCover(url)}
            />
          </div>
        </AdminCard>
      </div>

      <AdminCard title={t('productEditor.sectionTexts')} hint={t('productEditor.sectionTextsHint')}>
      <div role="tablist" className="mb-4 flex w-fit gap-1 rounded-pill bg-linen p-1">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active === l}
            onClick={() => setActive(l)}
            className={`inline-flex items-center gap-2 rounded-pill px-4 py-1.5 text-[0.875rem] font-semibold ${active === l ? 'bg-white text-charcoal shadow-[0_1px_3px_rgb(0_0_0/0.1)]' : 'text-stone hover:text-charcoal'}`}
          >
            <span aria-hidden className={`size-2 rounded-full ${translations[l]?.title ? 'bg-olive' : 'bg-hairline'}`} />
            {t(`locales.${l}`)}
          </button>
        ))}
      </div>
      <section role="tabpanel" lang={active} dir={meta.dir} data-script={meta.script} className="space-y-4">
        {tr ? (
          <>
            {(['title', 'subtitle', 'coverAlt'] as const).map((field) => (
              <TextField
                key={field}
                label={t(`productEditor.${field}`)}
                value={tr[field]}
                dir={meta.dir}
                lang={active}
                onChange={(v) => {
                  touch();
                  setTranslations((all) => ({ ...all, [active]: { ...tr, [field]: v } }));
                }}
              />
            ))}
            <MarkdownField
              id={`desc-${active}`}
              label={t('productEditor.description')}
              value={tr.descriptionMd}
              dir={meta.dir}
              lang={active}
              ebookSlugs={[]}
              rows={10}
              onChange={(v) => {
                touch();
                setTranslations((all) => ({ ...all, [active]: { ...tr, descriptionMd: v } }));
              }}
            />
          </>
        ) : (
          <div className="text-center">
            <p className="text-stone">{t('editor.notStarted')}</p>
            <button
              type="button"
              onClick={() => setTranslations((all) => ({ ...all, [active]: blankTranslation }))}
              className={`mt-3 ${primaryButton}`}
            >
              {t('editor.startTranslation')}
            </button>
          </div>
        )}
      </section>
      </AdminCard>

      <AdminCard title={t('productEditor.variants')} hint={t('productEditor.editionsHint')}>
        <p className="-mt-3 mb-2 text-[0.8125rem] font-medium text-stone">{t('productEditor.providerHint', { provider: t(`analytics.providers.${view.provider}`) })}</p>
        <div className="mt-4 space-y-4">
          {variants.map((v, i) => (
            <fieldset key={v.id ?? `new-${v.contentLocale}`} className="rounded-xl border border-hairline bg-linen/50 p-4">
              <legend className="px-1 font-medium">
                {t('productEditor.edition')}: {t(`locales.${v.contentLocale}`)}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label={t('productEditor.sku')} value={v.sku} dir="ltr" onChange={(sku) => setVariant(i, { sku: sku.toUpperCase() })} />
                <TextField label={t('productEditor.priceTry')} value={v.priceTry} dir="ltr" inputMode="decimal" onChange={(priceTry) => setVariant(i, { priceTry })} />
                <TextField label={t('productEditor.priceUsd')} value={v.priceUsd} dir="ltr" inputMode="decimal" onChange={(priceUsd) => setVariant(i, { priceUsd })} />
                <TextField label={t('productEditor.priceSar')} value={v.priceSar} dir="ltr" inputMode="decimal" onChange={(priceSar) => setVariant(i, { priceSar })} />
                <TextField label={t('productEditor.lsVariantId')} value={v.lsVariantId} dir="ltr" onChange={(lsVariantId) => setVariant(i, { lsVariantId })} />
                <TextField label={t('productEditor.paddlePriceId')} value={v.paddlePriceId} dir="ltr" onChange={(paddlePriceId) => setVariant(i, { paddlePriceId })} />
                <div className="flex items-end pb-2">
                  <CheckboxField
                    label={t('productEditor.active')}
                    checked={v.isActive}
                    // Selling needs a PDF and a MoR id (server rule); unchecking is always allowed.
                    disabled={!v.isActive && activationNeeds(v).length > 0}
                    describedBy={`activate-${v.contentLocale}`}
                    onChange={(isActive) => setVariant(i, { isActive })}
                  />
                </div>
              </div>
              {activationNeeds(v).length > 0 ? (
                <p id={`activate-${v.contentLocale}`} className="mt-2 text-[0.8125rem] text-stone">
                  {t('productEditor.activateNeeds', { missing: activationNeeds(v).join(', ') })}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="font-medium">{t('productEditor.pdf')}:</span>
                <span className="text-stone" dir="ltr">
                  {v.pdf
                    ? t('productEditor.pdfInfo', {
                        size:
                          v.pdf.size === null
                            ? t('common.none')
                            : v.pdf.size < 1_000_000
                              ? format.number(v.pdf.size / 1000, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 })
                              : format.number(v.pdf.size / 1_000_000, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }),
                        sha: v.pdf.sha ? v.pdf.sha.slice(0, 12) : t('common.none'),
                      })
                    : t('productEditor.pdfMissing')}
                </span>
                {v.id ? (
                  <UploadButton
                    kind="ebook_pdf"
                    entityId={v.id}
                    accept="application/pdf"
                    label={v.pdf ? t('common.replace') : t('common.upload')}
                    onUploaded={(key) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, pdf: { key, size: null, sha: null } } : x)))}
                  />
                ) : (
                  <span className="text-eyebrow text-muted">{t('productEditor.saveFirst')}</span>
                )}
              </div>
            </fieldset>
          ))}
        </div>
        {missingEditions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {missingEditions.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  touch();
                  setVariants((vs) => [
                    ...vs,
                    {
                      id: null,
                      contentLocale: l,
                      sku: `${product.slug}-${l}`.toUpperCase().replace(/[^A-Z0-9-]/g, '-').slice(0, 40),
                      priceTry: '',
                      priceUsd: '',
                      priceSar: '',
                      lsVariantId: '',
                      paddlePriceId: '',
                      isActive: false,
                      pdf: null,
                    },
                  ]);
                }}
                className={secondaryButton}
              >
                + {t('productEditor.addEdition', { locale: t(`locales.${l}`) })}
              </button>
            ))}
          </div>
        ) : null}
      </AdminCard>
      </div>
    </div>
  );
}
