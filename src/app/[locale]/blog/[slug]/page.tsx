import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MarkdownBody } from '@/components/blog/MarkdownBody';
import { RecipeMeta } from '@/components/blog/RecipeMeta';
import { EditorialImage } from '@/components/media/EditorialImage';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { contentDeps } from '@/services/container';
import { categoryKey } from '@/services/content/category';
import { blogPath, getArticle } from '@/services/content/posts.service';

export const dynamic = 'force-dynamic';

interface ArticlePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const loadArticle = cache(async (locale: Locale, slug: string) => {
  const [a, c, r] = await Promise.all([
    getTranslations({ locale, namespace: 'Article' }),
    getTranslations({ locale, namespace: 'Categories' }),
    getTranslations({ locale, namespace: 'Recipe' }),
  ]);
  return getArticle(contentDeps(), locale, slug, {
    authorName: a('author'),
    categoryLabel: (category) => c(categoryKey(category)),
    yieldLabel: (count) => r('yield', { count }),
  });
});

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const article = await loadArticle(locale, slug);
  if (!article) return {};
  const { post } = article;
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.dek ?? undefined,
    alternates: {
      canonical: article.canonicalUrl,
      languages: Object.fromEntries(article.alternates.map((alt) => [alt.locale, blogPath(alt.locale, alt.slug)])),
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.dek ?? undefined,
      locale: LOCALE_META[locale].ogLocale,
      url: article.canonicalUrl,
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      ...(post.imageUrl ? { images: [{ url: post.imageUrl, alt: post.imageAlt }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const article = await loadArticle(locale, slug);
  if (!article) notFound();

  const [t, c, format] = await Promise.all([
    getTranslations({ locale, namespace: 'Article' }),
    getTranslations({ locale, namespace: 'Categories' }),
    getFormatter({ locale }),
  ]);
  const { post, recipe } = article;

  return (
    <article className="pb-16 md:pb-24">
      {article.jsonLd && <JsonLd json={article.jsonLd} />}

      <header className="mx-auto max-w-[52rem] px-4 pt-10 text-center sm:px-6 md:pt-16 print:hidden">
        <Link
          href="/blog"
          className="inline-flex rounded-pill bg-terracotta-tint px-3 py-1.5 text-[0.8125rem] font-semibold text-terracotta-deep hover:bg-[#ffe9c7]"
        >
          {c(categoryKey(post.category))}
        </Link>
        <h1 className="mt-5 font-display text-h1 font-extrabold">{post.title}</h1>
        {post.dek && <p className="mx-auto mt-5 max-w-2xl text-dek text-stone">{post.dek}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {post.publishedAt && (
            <p className="text-[0.8125rem] font-medium text-muted">
              {t('publishedOn', { date: format.dateTime(new Date(post.publishedAt), { dateStyle: 'long', numberingSystem: LOCALE_META[locale].numberingSystem }) })}
            </p>
          )}
          <RecipeMeta totalMinutes={post.totalMinutes} difficulty={post.difficulty} />
        </div>
        {recipe && (
          <a
            href="#recipe"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-pill bg-terracotta px-6 text-ui font-semibold text-white shadow-[0_8px_20px_-8px_rgb(180_83_9/0.6)] transition-colors duration-200 ease-editorial hover:bg-terracotta-deep"
          >
            {t('jumpToRecipe')}
            <span aria-hidden>↓</span>
          </a>
        )}
      </header>

      <div className="mx-auto mt-10 max-w-wide px-4 sm:px-6 md:mt-14 print:hidden">
        <EditorialImage src={post.imageUrl} alt={post.imageAlt} aspect="aspect-[16/10]" category={post.category} priority radius="rounded-[2rem]" />
      </div>

      <div className="mx-auto mt-12 max-w-content px-4 sm:px-6 md:mt-16 print:hidden">
        <MarkdownBody parsed={article.body} ebooks={article.ebooks} />
      </div>

      {recipe && (
        <div className="px-4 sm:px-6 print:px-0">
          <RecipeCard recipe={recipe} />
        </div>
      )}
    </article>
  );
}
