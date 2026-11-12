import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MarkdownBody } from '@/components/blog/MarkdownBody';
import { BuyButton } from '@/components/commerce/BuyButton';
import { EbookCover } from '@/components/commerce/EbookCover';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { getEbook } from '@/services/catalog/catalog.service';
import { contentDeps } from '@/services/container';

export const dynamic = 'force-dynamic';

interface EbookPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const loadEbook = cache((locale: Locale, slug: string) => getEbook(contentDeps(), locale, slug));

export async function generateMetadata({ params }: EbookPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const ebook = await loadEbook(locale, slug);
  if (!ebook) return {};
  return {
    title: ebook.title,
    description: ebook.subtitle ?? undefined,
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/ebooks/${ebook.slug}`])) },
  };
}

export default async function EbookPage({ params }: EbookPageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const ebook = await loadEbook(locale, slug);
  if (!ebook) notFound();
  const t = await getTranslations({ locale, namespace: 'Ebooks' });

  return (
    <div className="mx-auto max-w-wide px-4 pt-8 pb-16 sm:px-6 md:pt-12 md:pb-24">
      <Link href="/ebooks" className="inline-flex min-h-10 items-center gap-2 rounded-pill bg-linen px-4 text-ui font-semibold hover:bg-hairline">
        <span aria-hidden className="inline-block rtl:-scale-x-100">
          ←
        </span>
        {t('back')}
      </Link>
      <div className="mt-8 grid items-start gap-10 md:grid-cols-12 md:gap-14">
        <div className="flex justify-center rounded-[2rem] bg-gradient-to-br from-terracotta-tint via-[#ffe8d6] to-linen px-8 py-14 md:sticky md:top-24 md:col-span-5">
          <EbookCover ebook={ebook} size="lg" />
        </div>
        <div className="md:col-span-7">
          <p className="text-[0.8125rem] font-semibold text-terracotta">
            {t('eyebrow')}
            {ebook.isFallbackEdition && (
              <span className="ms-2 rounded-pill bg-olive-tint px-2 py-0.5 normal-case">{t('fallbackEdition')}</span>
            )}
          </p>
          <h1 className="mt-2 font-display text-h1 font-extrabold">{ebook.title}</h1>
          {ebook.subtitle && <p className="mt-4 text-dek text-stone">{ebook.subtitle}</p>}
          <p className="mt-4 text-ui text-stone">
            {ebook.pageCount !== null && <>{t('pages', { count: ebook.pageCount })} · </>}
            {t('format')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[1.5rem] border border-hairline bg-white p-5 shadow-card">
            <p className="font-display text-h2 font-extrabold tabular-nums">{ebook.price.formatted}</p>
            <BuyButton variantId={ebook.variantId} productTitle={ebook.title} placement="storefront" />
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted">{t('priceNote')}</p>
          <MarkdownBody parsed={ebook.description} className="mt-10" />
        </div>
      </div>
    </div>
  );
}
