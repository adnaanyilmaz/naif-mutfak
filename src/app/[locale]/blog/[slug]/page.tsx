import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MarkdownBody } from '@/components/blog/MarkdownBody';
import { EditorialImage } from '@/components/media/EditorialImage';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { LOCALE_META, type Locale } from '@/i18n/config';
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

      <header className="mx-auto max-w-content px-6 pt-16 text-center md:pt-24 print:hidden">
        <p className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">{c(categoryKey(post.category))}</p>
        <h1 className="mt-4 font-display text-h1 font-semibold">{post.title}</h1>
        {post.dek && <p className="mt-5 font-serif text-dek text-stone italic arabic:not-italic">{post.dek}</p>}
        {post.publishedAt && (
          <p className="mt-5 text-ui text-stone">
            {t('publishedOn', { date: format.dateTime(new Date(post.publishedAt), { dateStyle: 'long' }) })}
          </p>
        )}
        {recipe && (
          <a
            href="#recipe"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-card bg-terracotta px-6 text-ui font-medium text-paper transition-colors duration-200 ease-editorial hover:bg-terracotta-deep"
          >
            {t('jumpToRecipe')}
            <span aria-hidden>↓</span>
          </a>
        )}
      </header>

      <div className="mx-auto mt-12 max-w-wide px-6 print:hidden">
        <EditorialImage src={post.imageUrl} alt={post.imageAlt} aspect="aspect-[3/2]" monogram={post.title.charAt(0)} priority />
      </div>

      <div className="mx-auto mt-12 max-w-content px-6 print:hidden">
        <MarkdownBody parsed={article.body} ebooks={article.ebooks} />
      </div>

      {recipe && (
        <div className="px-6 print:px-0">
          <RecipeCard recipe={recipe} />
        </div>
      )}
    </article>
  );
}
