import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RecipeArchive } from '@/components/blog/RecipeArchive';
import { getCategoryLabeler } from '@/i18n/category-label';
import { routing } from '@/i18n/routing';
import { contentDeps } from '@/services/container';
import { findCategory } from '@/services/content/category';
import { categoryPath, listActiveCategories, listPosts } from '@/services/content/posts.service';

export const dynamic = 'force-dynamic';

interface CategoryPageProps {
  params: Promise<{ locale: string; category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, category: raw } = await params;
  const category = findCategory(raw);
  if (!hasLocale(routing.locales, locale) || !category) return {};
  const [t, label] = await Promise.all([getTranslations({ locale, namespace: 'Blog' }), getCategoryLabeler(locale)]);
  return {
    title: label(category) ?? t('metaTitle'),
    description: t('dek'),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, categoryPath(l, category)])) },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, category: raw } = await params;
  const category = findCategory(raw);
  if (!hasLocale(routing.locales, locale) || !category) notFound();
  setRequestLocale(locale);
  const deps = contentDeps();
  const [t, label, posts, active] = await Promise.all([
    getTranslations({ locale, namespace: 'Blog' }),
    getCategoryLabeler(locale),
    listPosts(deps, locale, { category }),
    listActiveCategories(deps, locale),
  ]);

  return (
    <RecipeArchive
      title={label(category) ?? t('title')}
      dek={null}
      posts={posts}
      emptyLabel={t('emptyCategory')}
      categories={active.map((slug) => ({ slug, label: label(slug) ?? slug }))}
      activeCategory={category}
      allLabel={t('allCategories')}
      navLabel={t('categoriesNav')}
    />
  );
}
