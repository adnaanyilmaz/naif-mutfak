import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { EbookView } from '@/services/catalog/catalog.service';
import type { EbookCalloutVariant } from '@/services/content/markdown';
import { BuyButton } from './BuyButton';
import { EbookCover } from './EbookCover';

interface EbookCalloutProps {
  ebook: EbookView;
  variant: EbookCalloutVariant;
}

export async function EbookCallout({ ebook, variant }: EbookCalloutProps) {
  const t = await getTranslations('Ebooks');
  const href = `/ebooks/${ebook.slug}`;
  const data = { 'data-ebook-callout': ebook.slug, 'data-placement': variant };

  if (variant === 'inline') {
    return (
      <p {...data} className="my-8 border-s-4 border-terracotta ps-4 text-ui">
        <span className="font-semibold text-olive">{t('eyebrow')}: </span>
        <Link href={href} className="text-terracotta underline decoration-1 underline-offset-4">
          {ebook.title}
        </Link>{' '}
        · {ebook.price.formatted}
      </p>
    );
  }

  const compact = variant === 'compact';
  return (
    <aside
      {...data}
      aria-label={t('calloutLabel', { title: ebook.title })}
      className={`my-12 flex gap-5 rounded-card border-s-4 border-terracotta bg-linen ${compact ? 'items-center p-4' : 'flex-col p-6 sm:flex-row sm:items-start md:gap-8 md:p-8'} print:hidden`}
    >
      <Link href={href} tabIndex={-1} aria-hidden>
        <EbookCover ebook={ebook} size={compact ? 'sm' : 'md'} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">
          {t('eyebrow')}
          {ebook.isFallbackEdition && (
            <span className="ms-2 rounded-pill bg-olive-tint px-2 py-0.5 normal-case">{t('fallbackEdition')}</span>
          )}
        </p>
        <h3 className={`mt-2 font-display font-semibold ${compact ? 'text-ui' : 'text-h3'}`}>
          <Link href={href} className="hover:text-terracotta">
            {ebook.title}
          </Link>
        </h3>
        {!compact && ebook.subtitle && (
          <p className="mt-1 font-serif text-dek text-stone italic arabic:not-italic">{ebook.subtitle}</p>
        )}
        {!compact && (
          <p className="mt-3 text-ui text-stone">
            {ebook.pageCount !== null && <>{t('pages', { count: ebook.pageCount })} · </>}
            {t('format')}
          </p>
        )}
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${compact ? 'mt-2' : 'mt-5'}`}>
          <p className="text-h3 font-semibold tabular-nums">{ebook.price.formatted}</p>
          <BuyButton variantId={ebook.variantId} productTitle={ebook.title} placement="callout" size={compact ? 'sm' : 'md'} />
        </div>
        {!compact && <p className="mt-1 text-ui text-stone">{t('priceNote')}</p>}
      </div>
    </aside>
  );
}
