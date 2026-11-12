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
    <div className="mx-auto max-w-wide px-6 py-16 md:py-24">
      <Link href="/ebooks" className="inline-flex items-center gap-2 text-ui text-terracotta underline underline-offset-4">
        <span aria-hidden className="inline-block rtl:-scale-x-100">
          ←
        </span>
        {t('back')}
      </Link>
      <div className="mt-10 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <EbookCover ebook={ebook} size="lg" />
        </div>
        <div className="md:col-span-7">
          <p className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">
            {t('eyebrow')}
            {ebook.isFallbackEdition && (
              <span className="ms-2 rounded-pill bg-olive-tint px-2 py-0.5 normal-case">{t('fallbackEdition')}</span>
            )}
          </p>
          <h1 className="mt-3 font-display text-h1 font-semibold">{ebook.title}</h1>
          {ebook.subtitle && <p className="mt-4 font-serif text-dek text-stone italic arabic:not-italic">{ebook.subtitle}</p>}
          <p className="mt-4 text-ui text-stone">
            {ebook.pageCount !== null && <>{t('pages', { count: ebook.pageCount })} · </>}
            {t('format')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-hairline py-6">
            <p className="text-h2 font-semibold tabular-nums">{ebook.price.formatted}</p>
            <BuyButton variantId={ebook.variantId} productTitle={ebook.title} placement="storefront" />
          </div>
          <p className="mt-2 text-ui text-stone">{t('priceNote')}</p>
          <MarkdownBody parsed={ebook.description} className="mt-10" />
        </div>
      </div>
    </div>
  );
}
