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

function Arrow() {
  return (
    <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5">
      →
    </span>
  );
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Home' });

  const deps = contentDeps();
  const [posts, ebooks] = await Promise.all([listPosts(deps, locale, { limit: 9 }), listEbooks(deps, locale)]);
  const [lead, ...latest] = posts;
  const featuredEbook = ebooks[0];

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-page items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:pt-16 lg:grid-cols-12 lg:gap-14 lg:pb-24">
        <div className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 rounded-pill bg-terracotta-tint px-3 py-1.5 text-[0.8125rem] font-semibold text-terracotta-deep">
            <span aria-hidden className="size-1.5 rounded-full bg-terracotta" />
            {t('eyebrow')}
          </p>
          <h1 className="mt-6 font-display text-display font-extrabold">{t('title')}</h1>
          <p className="mt-6 max-w-xl text-dek text-stone">{t('dek')}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="group inline-flex min-h-12 items-center gap-2 rounded-pill bg-charcoal px-6 text-ui font-semibold text-white transition-colors duration-200 hover:bg-terracotta"
            >
              {t('cta')}
              <Arrow />
            </Link>
            <Link
              href="/ebooks"
              className="inline-flex min-h-12 items-center rounded-pill border border-hairline bg-white px-6 text-ui font-semibold transition-colors duration-200 hover:border-charcoal"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </div>
        {lead && (
          <div className="lg:col-span-6">
            <p className="mb-3 text-eyebrow font-semibold text-muted uppercase arabic:normal-case">{t('featured')}</p>
            <StoryCard post={lead} size="feature" />
          </div>
        )}
      </section>

      {/* Latest */}
      {latest.length > 0 && (
        <section aria-labelledby="latest-title" className="mx-auto max-w-page px-4 pb-16 sm:px-6 md:pb-24">
          <div className="flex items-end justify-between gap-4">
            <h2 id="latest-title" className="font-display text-h2 font-extrabold">
              {t('latest')}
            </h2>
            <Link href="/blog" className="group inline-flex items-center gap-1.5 text-ui font-semibold text-terracotta hover:text-terracotta-deep">
              {t('viewAll')}
              <Arrow />
            </Link>
          </div>
          <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => (
              <StoryCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {featuredEbook && (
        <section aria-label={t('ebookEyebrow')} className="mx-auto max-w-page px-4 pb-16 sm:px-6 md:pb-24">
          <EbookCallout ebook={featuredEbook} variant="full" eyebrow={t('ebookEyebrow')} />
        </section>
      )}
    </>
  );
}
