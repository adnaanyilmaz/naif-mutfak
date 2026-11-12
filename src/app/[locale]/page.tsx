import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Home' });

  return (
    <section className="mx-auto max-w-wide px-6 py-16 md:py-24">
      <p className="text-eyebrow font-semibold uppercase text-olive arabic:normal-case">{t('eyebrow')}</p>
      <h1 className="mt-4 max-w-content font-display text-display font-semibold">{t('title')}</h1>
      <p className="mt-6 max-w-content font-serif text-dek italic text-stone arabic:not-italic">{t('dek')}</p>
      <Link
        href="/recipes"
        className="mt-10 inline-flex items-center gap-2 rounded-card bg-terracotta px-6 py-3 text-ui font-medium text-paper transition-colors duration-200 ease-editorial hover:bg-terracotta-deep"
      >
        {t('cta')}
        <span aria-hidden className="inline-block rtl:-scale-x-100">
          →
        </span>
      </Link>
    </section>
  );
}
