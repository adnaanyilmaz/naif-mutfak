import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RecipeArchive } from '@/components/blog/RecipeArchive';
import { getCategoryLabeler } from '@/i18n/category-label';
import { routing } from '@/i18n/routing';
import { contentDeps } from '@/services/container';
import { listActiveCategories, listPosts } from '@/services/content/posts.service';

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
  const deps = contentDeps();
  const [t, label, posts, active] = await Promise.all([
    getTranslations({ locale, namespace: 'Blog' }),
    getCategoryLabeler(locale),
    listPosts(deps, locale),
    listActiveCategories(deps, locale),
  ]);

  return (
    <RecipeArchive
      title={t('title')}
      dek={t('dek')}
      posts={posts}
      emptyLabel={t('empty')}
      categories={active.map((slug) => ({ slug, label: label(slug) ?? slug }))}
      activeCategory={null}
      allLabel={t('allCategories')}
      navLabel={t('categoriesNav')}
    />
  );
}
