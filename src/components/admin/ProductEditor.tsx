'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { LOCALE_META } from '@/i18n/config';
import type { AdminProductEditView, ProductIssue, SaveProductResult } from '@/services/admin/products-admin.service';
import { PRODUCT_STATUSES } from '@/validators/admin/product';
import { LOCALES, type Locale } from '@/validators/content';
import { CheckboxField, SelectField, TextField } from './fields';
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

  function save() {
    const payload = {
      productId: view.product.id,
      expectedUpdatedAt: view.updatedAtSeconds,
      product: { slug: product.slug, status: product.status, pageCount: product.pageCount.trim() === '' ? null : Number(product.pageCount) },
      translations: LOCALES.flatMap((l) => {
        const x = translations[l];
        return x && x.title.trim() ? [{ locale: l, ...x }] : [];
      }),
      variants: variants.map(({ pdf: _pdf, ...v }) => v),
    };
    startTransition(async () => {
      const result = await saveAction(payload);
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

  const missingEditions = LOCALES.filter((l) => !variants.some((v) => v.contentLocale === l));

  return (
    <div className="mx-auto max-w-page">
      <header className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-cream/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <h1 className="font-display text-h3">{translations.tr?.title || product.slug}</h1>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-eyebrow text-muted">
            {pending ? t('common.saving') : status === 'saved' ? t('common.saved') : ''}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-pill bg-terracotta px-4 py-2 font-medium text-white hover:bg-terracotta-deep disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </header>

      {status === 'conflict' ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-danger bg-paper p-3 text-danger">
          <span>{t('editor.conflict')}</span>
          <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
            {t('common.reload')}
          </button>
        </div>
      ) : null}
      {issues ? (
        <div role="alert" className="mt-4 rounded-card border border-danger bg-paper p-3">
          <p className="font-medium text-danger">{t('editor.issuesTitle')}</p>
          <ul className="mt-1 list-disc ps-5 text-stone">
            {issues.map((i) => (
              <li key={`${i.path}:${i.code}`}>
                {i.path.startsWith('variants.') && /^variants\.(tr|en|ar)/.test(i.path)
                  ? t('issues.inLocale', { locale: i.path.slice(9, 11).toUpperCase(), message: t(`issues.${i.code}`, { path: i.path }) })
                  : t(`issues.${i.code}`, { path: i.path })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 rounded-card border border-hairline bg-paper p-4 md:grid-cols-[auto_1fr] md:p-5">
        <div className="flex flex-col items-start gap-2">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of the R2 original
            <img src={cover} alt="" className="h-40 w-28 rounded-card object-cover shadow-card" />
          ) : (
            <span className="flex h-40 w-28 items-center justify-center rounded-card bg-linen text-center text-eyebrow text-muted">{t('productEditor.noCover')}</span>
          )}
          <UploadButton
            kind="product_cover"
            entityId={view.product.id}
            accept="image/jpeg,image/png,image/webp"
            label={cover ? t('common.replace') : t('productEditor.cover')}
            onUploaded={(_key, url) => setCover(url)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label={t('productEditor.slug')}
            value={product.slug}
            dir="ltr"
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
      </section>

      <div role="tablist" className="mt-6 flex gap-1">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active === l}
            onClick={() => setActive(l)}
            className={`rounded-t-card border border-b-0 border-hairline px-4 py-2 ${active === l ? 'bg-paper font-medium' : 'bg-linen text-stone'}`}
          >
            {l.toUpperCase()} {translations[l]?.title ? '●' : '○'}
          </button>
        ))}
      </div>
      <section role="tabpanel" lang={active} dir={meta.dir} data-script={meta.script} className="space-y-4 rounded-card border border-hairline bg-paper p-4 md:p-5">
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
              className="mt-3 rounded-pill bg-charcoal px-4 py-2 text-white"
            >
              {t('editor.startTranslation')}
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-card border border-hairline bg-paper p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-h3">{t('productEditor.variants')}</h2>
          <p className="text-eyebrow text-muted">{t('productEditor.providerHint', { provider: t(`analytics.providers.${view.provider}`) })}</p>
        </div>
        <div className="mt-4 space-y-4">
          {variants.map((v, i) => (
            <fieldset key={v.id ?? `new-${v.contentLocale}`} className="rounded-card border border-hairline bg-cream p-3">
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
                  <CheckboxField label={t('productEditor.active')} checked={v.isActive} onChange={(isActive) => setVariant(i, { isActive })} />
                </div>
              </div>
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
                className="rounded-pill border border-hairline bg-paper px-3 py-1.5 hover:bg-linen"
              >
                + {t('productEditor.addEdition', { locale: t(`locales.${l}`) })}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
