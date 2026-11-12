import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'About' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/about`])) },
  };
}

const PRINCIPLES = [
  { key: 'Simple', icon: 'M5 12h14M12 5v14' },
  { key: 'Tested', icon: 'm5 12 4.5 4.5L19 7' },
  { key: 'Languages', icon: 'M4 6h16M4 12h10M4 18h7' },
] as const;

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'About' });

  return (
    <div className="pb-16 md:pb-24">
      {/* Intro */}
      <section className="mx-auto grid max-w-page items-center gap-10 px-4 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 rounded-pill bg-terracotta-tint px-3 py-1.5 text-[0.8125rem] font-semibold text-terracotta-deep">
            <span aria-hidden className="size-1.5 rounded-full bg-terracotta" />
            {t('eyebrow')}
          </p>
          <h1 className="mt-6 font-display text-h1 font-extrabold">{t('title')}</h1>
          <p className="mt-6 max-w-xl text-dek text-stone">{t('intro')}</p>
        </div>
        <div className="relative lg:col-span-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP */}
          <img
            src="/images/about-kneading.webp"
            alt={t('imageAlt')}
            width={1600}
            height={1094}
            fetchPriority="high"
            className="aspect-[4/3] w-full rounded-[2rem] object-cover"
          />
          <div className="absolute -bottom-6 start-6 rounded-full bg-white p-1.5 shadow-lift">
            <Logo size={88} wordmark={false} />
          </div>
        </div>
      </section>

      {/* Story */}
      <section aria-labelledby="story-title" className="mx-auto mt-20 max-w-content px-4 sm:px-6 md:mt-28">
        <h2 id="story-title" className="font-display text-h2 font-extrabold">
          {t('storyTitle')}
        </h2>
        <div className="prose-editorial mt-6">
          <p>{t('story1')}</p>
          <p>{t('story2')}</p>
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles-title" className="mx-auto mt-20 max-w-page px-4 sm:px-6 md:mt-28">
        <h2 id="principles-title" className="font-display text-h2 font-extrabold">
          {t('principlesTitle')}
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map(({ key, icon }) => (
            <li key={key} className="rounded-[1.75rem] border border-hairline bg-white p-6 md:p-8">
              <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-terracotta-tint text-terracotta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
                  <path d={icon} />
                </svg>
              </span>
              <h3 className="mt-5 font-display text-h3 font-bold">{t(`principle${key}Title`)}</h3>
              <p className="mt-2 text-stone">{t(`principle${key}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* What you'll find */}
      <section aria-labelledby="features-title" className="mx-auto mt-20 max-w-page px-4 sm:px-6 md:mt-28">
        <div className="grid gap-8 rounded-[2rem] bg-linen p-6 sm:p-10 md:grid-cols-2 md:items-center md:p-14">
          <h2 id="features-title" className="font-display text-h2 font-extrabold">
            {t('featuresTitle')}
          </h2>
          <ul className="space-y-3">
            {(['featureRecipes', 'featureEbooks', 'featureNewsletter'] as const).map((k) => (
              <li key={k} className="flex items-start gap-3 rounded-2xl bg-white p-4">
                <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-terracotta text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                    <path d="m5 12 4.5 4.5L19 7" />
                  </svg>
                </span>
                <span className="font-medium">{t(k)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-20 max-w-content px-4 text-center sm:px-6 md:mt-28">
        <h2 className="font-display text-h2 font-extrabold">{t('ctaTitle')}</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/blog"
            className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-charcoal px-6 text-ui font-semibold text-white transition-colors hover:bg-terracotta"
          >
            {t('ctaRecipes')}
            <span aria-hidden className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
          <Link
            href="/ebooks"
            className="inline-flex min-h-12 items-center rounded-pill border border-hairline bg-white px-6 text-ui font-semibold transition-colors hover:border-charcoal"
          >
            {t('ctaEbooks')}
          </Link>
        </div>
      </section>
    </div>
  );
}
