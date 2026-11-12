import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { StoryCard } from '@/components/blog/StoryCard';
import { routing } from '@/i18n/routing';
import { contentDeps } from '@/services/container';
import { listPosts } from '@/services/content/posts.service';

export const dynamic = 'force-dynamic';

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Blog' });
  return {
    title: t('metaTitle'),
    description: t('dek'),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/blog`])) },
  };
}

export default async function BlogArchivePage({ params }: BlogPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Blog' });
  const posts = await listPosts(contentDeps(), locale);

  return (
    <div className="mx-auto max-w-page px-6 py-16 md:py-24">
      <header className="max-w-content">
        <h1 className="font-display text-display font-semibold">{t('title')}</h1>
        <p className="mt-4 font-serif text-dek text-stone italic arabic:not-italic">{t('dek')}</p>
      </header>
      {posts.length === 0 ? (
        <p className="mt-16 text-ui text-stone">{t('empty')}</p>
      ) : (
        <div className="mt-16 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <StoryCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
