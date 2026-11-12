import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EbookCover } from '@/components/commerce/EbookCover';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { listEbooks } from '@/services/catalog/catalog.service';
import { contentDeps } from '@/services/container';

export const dynamic = 'force-dynamic';

interface EbooksPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: EbooksPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Ebooks' });
  return {
    title: t('title'),
    description: t('dek'),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/ebooks`])) },
  };
}

export default async function EbooksPage({ params }: EbooksPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Ebooks' });
  const ebooks = await listEbooks(contentDeps(), locale);

  return (
    <div className="mx-auto max-w-page px-6 py-16 md:py-24">
      <header className="max-w-content">
        <h1 className="font-display text-display font-semibold">{t('title')}</h1>
        <p className="mt-4 font-serif text-dek text-stone italic arabic:not-italic">{t('dek')}</p>
      </header>
      {ebooks.length === 0 ? (
        <p className="mt-16 text-ui text-stone">{t('empty')}</p>
      ) : (
        <ul className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {ebooks.map((e) => (
            <li key={e.id} className="group flex flex-col items-start">
              <Link href={`/ebooks/${e.slug}`} tabIndex={-1} aria-hidden className="w-full">
                <EbookCover ebook={e} size="lg" />
              </Link>
              <p className="mt-6 text-eyebrow font-semibold text-olive uppercase arabic:normal-case">
                {t('eyebrow')}
                {e.isFallbackEdition && <span className="ms-2 normal-case">· {t('fallbackEdition')}</span>}
              </p>
              <h2 className="mt-2 font-display text-h3 font-semibold">
                <Link href={`/ebooks/${e.slug}`} className="decoration-terracotta underline-offset-4 group-hover:underline">
                  {e.title}
                </Link>
              </h2>
              {e.subtitle && <p className="mt-2 font-serif text-dek text-stone italic arabic:not-italic">{e.subtitle}</p>}
              <p className="mt-4 text-ui text-stone">
                {e.pageCount !== null && <>{t('pages', { count: e.pageCount })} · </>}
                {t('format')}
              </p>
              <p className="mt-2 text-h3 font-semibold tabular-nums">{e.price.formatted}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
