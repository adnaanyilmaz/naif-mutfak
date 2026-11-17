import type { PostAlternate, PostDetail, PostsRepo, PostSummary } from '@/repositories/posts';
import { getEbooksBySlugs, type CatalogDeps, type EbookView } from '@/services/catalog/catalog.service';
import { mediaUrl } from '@/services/media/image-url';
import { YOUTUBE_ID_PATTERN } from '@/services/media/youtube';
import { serializeJsonLd } from '@/services/seo/jsonld';
import { buildRecipeJsonLd } from '@/services/seo/recipe-jsonld';
import type { Ingredients, Instructions, Locale, VideoMode } from '@/validators/content';
import { categoriesWithPosts, type CategoryKey } from './category';
import { ebookSlugs, parseMarkdown, type ParsedMarkdown } from './markdown';

export interface ContentDeps extends CatalogDeps {
  posts: PostsRepo;
  siteUrl: string;
}

export interface PostCardView {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  category: string;
  imageUrl: string | null;
  imageAlt: string;
  publishedAt: string | null;
  /** Recipes only: prep + cook + rest. */
  totalMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'advanced' | null;
}

export interface RecipeView {
  postId: string;
  title: string;
  baseServings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  totalMinutes: number | null;
  difficulty: PostDetail['difficulty'];
  ingredients: Ingredients;
  instructions: Instructions;
  /** Step id → public image URL, for steps that carry an image. */
  stepImageUrls: Record<string, string>;
  video: { youtubeId: string; mode: VideoMode } | null;
}

export interface ArticleView {
  post: PostCardView & { seoTitle: string | null; seoDescription: string | null; updatedAt: string };
  canonicalUrl: string;
  alternates: PostAlternate[];
  body: ParsedMarkdown;
  ebooks: Record<string, EbookView>;
  recipe: RecipeView | null;
  /** Escaped, ready for `<script type="application/ld+json">`; null when the post is not a recipe. */
  jsonLd: string | null;
}

/** Localized strings needed by structured data; supplied by the page (services stay i18n-agnostic). */
export interface ArticleLabels {
  authorName: string;
  categoryLabel: (category: string) => string | null;
  yieldLabel: (servings: number) => string;
}

export const ARCHIVE_PAGE_SIZE = 12;

export function categoryPath(locale: Locale, category: CategoryKey): string {
  return `/${locale}/blog/kategori/${category}`;
}

export function blogPath(locale: Locale, slug: string): string {
  return `/${locale}/blog/${slug}`;
}

function toCard(p: PostSummary, mediaBaseUrl: string): PostCardView {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    dek: p.dek,
    category: p.category,
    imageUrl: p.heroImageKey ? mediaUrl(mediaBaseUrl, p.heroImageKey, 1080) : null,
    imageAlt: p.heroImageAlt ?? p.title,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    totalMinutes: p.isRecipe ? sumMinutes(p) : null,
    difficulty: p.isRecipe ? p.difficulty : null,
  };
}

function sumMinutes(p: Pick<PostSummary, 'prepMinutes' | 'cookMinutes' | 'restMinutes'>): number | null {
  const parts = [p.prepMinutes, p.cookMinutes, p.restMinutes].filter((v): v is number => v !== null);
  return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
}

export async function listPosts(
  deps: Pick<ContentDeps, 'posts' | 'mediaBaseUrl'>,
  locale: Locale,
  opts: { page?: number; limit?: number; category?: CategoryKey } = {},
): Promise<PostCardView[]> {
  const limit = Math.min(Math.max(opts.limit ?? ARCHIVE_PAGE_SIZE, 1), 48);
  const page = Math.max(opts.page ?? 1, 1);
  const rows = await deps.posts.listPublished(locale, {
    limit,
    offset: (page - 1) * limit,
    ...(opts.category ? { category: opts.category } : {}),
  });
  return rows.map((r) => toCard(r, deps.mediaBaseUrl));
}

/** Categories that have at least one published post in this locale, in display order. */
export async function listActiveCategories(deps: Pick<ContentDeps, 'posts'>, locale: Locale): Promise<CategoryKey[]> {
  return categoriesWithPosts(await deps.posts.countPublishedByCategory(locale));
}

export const STEP_IMAGE_WIDTH = 1080;

function stepImageUrls(instructions: Instructions, mediaBaseUrl: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of instructions) {
    for (const step of section.steps) {
      if (step.imageKey) out[step.id] = mediaUrl(mediaBaseUrl, step.imageKey, STEP_IMAGE_WIDTH);
    }
  }
  return out;
}

export function toRecipe(p: PostDetail, mediaBaseUrl: string): RecipeView | null {
  if (!p.isRecipe || !p.ingredients || !p.instructions || !p.baseServings) return null;
  return {
    postId: p.id,
    title: p.title,
    baseServings: p.baseServings,
    prepMinutes: p.prepMinutes,
    cookMinutes: p.cookMinutes,
    restMinutes: p.restMinutes,
    totalMinutes: sumMinutes(p),
    difficulty: p.difficulty,
    ingredients: p.ingredients,
    instructions: p.instructions,
    stepImageUrls: stepImageUrls(p.instructions, mediaBaseUrl),
    video: p.youtubeVideoId && YOUTUBE_ID_PATTERN.test(p.youtubeVideoId) ? { youtubeId: p.youtubeVideoId, mode: p.videoMode } : null,
  };
}

export async function getArticle(
  deps: ContentDeps,
  locale: Locale,
  slug: string,
  labels: ArticleLabels,
): Promise<ArticleView | null> {
  const post = await deps.posts.findPublishedBySlug(locale, slug);
  if (!post) return null;

  const body = parseMarkdown(post.bodyMd);
  const [alternates, ebooks] = await Promise.all([
    deps.posts.listPublishedAlternates(post.id),
    getEbooksBySlugs(deps, locale, ebookSlugs(body)),
  ]);

  const canonicalUrl = `${deps.siteUrl.replace(/\/+$/, '')}${blogPath(locale, post.slug)}`;
  const recipe = toRecipe(post, deps.mediaBaseUrl);
  const jsonLd =
    recipe === null
      ? null
      : serializeJsonLd(
          buildRecipeJsonLd({
            title: post.title,
            description: post.dek,
            locale,
            canonicalUrl,
            imageUrls: post.heroImageKey
              ? [1600, 1080].map((w) => mediaUrl(deps.mediaBaseUrl, post.heroImageKey ?? '', w))
              : [],
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
            authorName: labels.authorName,
            prepMinutes: post.prepMinutes,
            cookMinutes: post.cookMinutes,
            restMinutes: post.restMinutes,
            baseServings: recipe.baseServings,
            yieldLabel: labels.yieldLabel(recipe.baseServings),
            categoryLabel: labels.categoryLabel(post.category),
            cuisine: post.cuisine,
            keywords: post.keywords,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            imageUrl: (key) => mediaUrl(deps.mediaBaseUrl, key, STEP_IMAGE_WIDTH),
          }),
        );

  return {
    post: {
      ...toCard(post, deps.mediaBaseUrl),
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      updatedAt: post.updatedAt.toISOString(),
    },
    canonicalUrl,
    alternates,
    body,
    ebooks,
    recipe,
    jsonLd,
  };
}
