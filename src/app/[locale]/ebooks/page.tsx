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
    <div className="mx-auto max-w-page px-4 pt-10 pb-16 sm:px-6 md:pt-16 md:pb-24">
      <header className="max-w-content">
        <h1 className="font-display text-display font-extrabold">{t('title')}</h1>
        <p className="mt-4 text-dek text-stone">{t('dek')}</p>
      </header>
      {ebooks.length === 0 ? (
        <p className="mt-16 text-ui text-stone">{t('empty')}</p>
      ) : (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ebooks.map((e) => (
            <li key={e.id} className="group relative flex flex-col rounded-[1.75rem] border border-hairline bg-white p-3 transition-shadow duration-300 hover:shadow-lift">
              <div className="flex justify-center rounded-[1.25rem] bg-gradient-to-b from-terracotta-tint to-linen px-6 py-10">
                <EbookCover ebook={e} size="md" />
              </div>
              <p className="mt-5 px-3 text-[0.8125rem] font-semibold text-terracotta">
                {t('eyebrow')}
                {e.isFallbackEdition && <span className="ms-2 normal-case">· {t('fallbackEdition')}</span>}
              </p>
              <h2 className="mt-1 px-3 font-display text-h3 font-extrabold">
                <Link href={`/ebooks/${e.slug}`} className="after:absolute after:inset-0 after:rounded-[1.75rem] group-hover:text-terracotta">
                  {e.title}
                </Link>
              </h2>
              {e.subtitle && <p className="mt-2 line-clamp-2 px-3 text-ui text-stone">{e.subtitle}</p>}
              <div className="mt-auto flex items-center justify-between gap-3 px-3 pt-5 pb-2">
                <p className="text-[0.8125rem] text-muted">
                {e.pageCount !== null && <>{t('pages', { count: e.pageCount })} · </>}
                {t('format')}
              </p>
                <p className="rounded-pill bg-charcoal px-3 py-1 text-ui font-bold text-white tabular-nums">{e.price.formatted}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
