import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { StoryCard } from '@/components/blog/StoryCard';
import { EbookCallout } from '@/components/commerce/EbookCallout';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { listEbooks } from '@/services/catalog/catalog.service';
import { contentDeps } from '@/services/container';
import { listPosts } from '@/services/content/posts.service';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Home' });

  const deps = contentDeps();
  const [posts, ebooks] = await Promise.all([listPosts(deps, locale, { limit: 7 }), listEbooks(deps, locale)]);
  const [lead, ...rest] = posts;
  const secondary = rest.slice(0, 3);
  const more = rest.slice(3);
  const featuredEbook = ebooks[0];

  return (
    <>
      <section className="mx-auto max-w-page px-6 pt-16 md:pt-24">
        <p className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">{t('eyebrow')}</p>
        <h1 className="mt-4 max-w-content font-display text-display font-semibold">{t('title')}</h1>
        <p className="mt-6 max-w-content font-serif text-dek text-stone italic arabic:not-italic">{t('dek')}</p>
      </section>

      {lead && (
        <section aria-label={t('latest')} className="mx-auto grid max-w-page gap-12 px-6 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7">
            <StoryCard post={lead} size="lead" />
          </div>
          <div className="flex flex-col gap-10 md:col-span-5">
            <h2 className="border-b border-hairline pb-3 text-eyebrow font-semibold text-stone uppercase arabic:normal-case">
              {t('latest')}
            </h2>
            {secondary.map((p) => (
              <StoryCard key={p.id} post={p} size="compact" />
            ))}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 self-start text-ui font-medium text-terracotta underline decoration-1 underline-offset-4"
            >
              {t('viewAll')}
              <span aria-hidden className="inline-block rtl:-scale-x-100">
                →
              </span>
            </Link>
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="mx-auto grid max-w-page gap-12 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((p) => (
            <StoryCard key={p.id} post={p} />
          ))}
        </section>
      )}

      {featuredEbook && (
        <section className="mx-auto max-w-wide px-6 pb-16 md:pb-24">
          <p className="text-eyebrow font-semibold text-stone uppercase arabic:normal-case">{t('ebookEyebrow')}</p>
          <EbookCallout ebook={featuredEbook} variant="full" />
        </section>
      )}
    </>
  );
}
