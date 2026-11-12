import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { EbookView } from '@/services/catalog/catalog.service';
import type { EbookCalloutVariant } from '@/services/content/markdown';
import { BuyButton } from './BuyButton';
import { EbookCover } from './EbookCover';

interface EbookCalloutProps {
  ebook: EbookView;
  variant: EbookCalloutVariant;
  /** Overrides the default "E-book" label (home page uses a section eyebrow). */
  eyebrow?: string;
}

export async function EbookCallout({ ebook, variant, eyebrow }: EbookCalloutProps) {
  const t = await getTranslations('Ebooks');
  const href = `/ebooks/${ebook.slug}`;
  const data = { 'data-ebook-callout': ebook.slug, 'data-placement': variant };
  const label = eyebrow ?? t('eyebrow');

  if (variant === 'inline') {
    return (
      <p {...data} className="my-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-terracotta-tint px-4 py-3 text-ui">
        <span className="font-semibold text-terracotta-deep">{label}</span>
        <Link href={href} className="font-semibold underline decoration-1 underline-offset-4 hover:text-terracotta">
          {ebook.title}
        </Link>
        <span className="text-stone tabular-nums">{ebook.price.formatted}</span>
      </p>
    );
  }

  const fallback = ebook.isFallbackEdition && (
    <span className="ms-2 rounded-pill bg-white/15 px-2 py-0.5 text-[0.75rem] font-medium normal-case">{t('fallbackEdition')}</span>
  );

  if (variant === 'compact') {
    return (
      <aside
        {...data}
        aria-label={t('calloutLabel', { title: ebook.title })}
        className="my-10 flex items-center gap-4 rounded-card border border-hairline bg-white p-4 shadow-card print:hidden"
      >
        <Link href={href} tabIndex={-1} aria-hidden>
          <EbookCover ebook={ebook} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-semibold text-terracotta">{label}</p>
          <h3 className="mt-0.5 truncate font-display text-ui font-bold">
            <Link href={href} className="hover:text-terracotta">
              {ebook.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-ui font-semibold tabular-nums">{ebook.price.formatted}</p>
        </div>
        <BuyButton variantId={ebook.variantId} productTitle={ebook.title} placement="callout" size="sm" />
      </aside>
    );
  }

  // Full: dark banner with the cover floating on a warm glow.
  return (
    <aside
      {...data}
      aria-label={t('calloutLabel', { title: ebook.title })}
      className="relative my-12 overflow-hidden rounded-[2rem] bg-charcoal text-white print:hidden"
    >
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -start-24 size-80 rounded-full bg-brand opacity-40 blur-3xl" />
      <div className="relative grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[auto_1fr] md:gap-12 md:p-12">
        <Link href={href} tabIndex={-1} aria-hidden className="justify-self-center md:justify-self-start">
          <EbookCover ebook={ebook} size="md" />
        </Link>
        <div className="min-w-0">
          <p className="text-eyebrow font-semibold text-[#fcc56b] uppercase arabic:normal-case">
            {label}
            {fallback}
          </p>
          <h3 className="mt-3 font-display text-h2 font-extrabold">
            <Link href={href} className="hover:text-[#fcc56b]">
              {ebook.title}
            </Link>
          </h3>
          {ebook.subtitle && <p className="mt-3 max-w-xl text-dek text-white/75">{ebook.subtitle}</p>}
          <p className="mt-4 text-ui text-white/60">
            {ebook.pageCount !== null && <>{t('pages', { count: ebook.pageCount })} · </>}
            {t('format')}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="font-display text-h2 font-extrabold tabular-nums">{ebook.price.formatted}</p>
            <BuyButton variantId={ebook.variantId} productTitle={ebook.title} placement="callout" tone="light" />
          </div>
          <p className="mt-2 text-[0.8125rem] text-white/50">{t('priceNote')}</p>
        </div>
      </div>
    </aside>
  );
}
