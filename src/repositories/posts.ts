import { and, desc, eq } from 'drizzle-orm';
import { posts, postTranslations } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Ingredients, Instructions, Locale } from '@/validators/content';

export interface PostSummary {
  id: string;
  locale: Locale;
  slug: string;
  title: string;
  dek: string | null;
  category: string;
  heroImageKey: string | null;
  heroImageAlt: string | null;
  isRecipe: boolean;
  publishedAt: Date | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'advanced' | null;
}

export interface PostDetail extends PostSummary {
  bodyMd: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ingredients: Ingredients | null;
  instructions: Instructions | null;
  keywords: string[] | null;
  cuisine: string | null;
  baseServings: number | null;
  featuredProductId: string | null;
  updatedAt: Date;
}

export interface PostAlternate {
  locale: Locale;
  slug: string;
}

export interface PostsRepo {
  listPublished(locale: Locale, opts: { limit: number; offset: number }): Promise<PostSummary[]>;
  findPublishedBySlug(locale: Locale, slug: string): Promise<PostDetail | null>;
  listPublishedAlternates(postId: string): Promise<PostAlternate[]>;
}

const summaryColumns = {
  id: posts.id,
  locale: postTranslations.locale,
  slug: postTranslations.slug,
  title: postTranslations.title,
  dek: postTranslations.dek,
  category: posts.category,
  heroImageKey: posts.heroImageKey,
  heroImageAlt: postTranslations.heroImageAlt,
  isRecipe: posts.isRecipe,
  publishedAt: posts.publishedAt,
  prepMinutes: posts.prepMinutes,
  cookMinutes: posts.cookMinutes,
  restMinutes: posts.restMinutes,
  difficulty: posts.difficulty,
};

const isPublic = and(eq(posts.status, 'published'), eq(postTranslations.isPublished, true));

export function createPostsRepo(db: Db): PostsRepo {
  return {
    async listPublished(locale, { limit, offset }) {
      return db
        .select(summaryColumns)
        .from(postTranslations)
        .innerJoin(posts, eq(posts.id, postTranslations.postId))
        .where(and(isPublic, eq(postTranslations.locale, locale)))
        .orderBy(desc(posts.publishedAt))
        .limit(limit)
        .offset(offset);
    },

    async findPublishedBySlug(locale, slug) {
      const rows = await db
        .select({
          ...summaryColumns,
          bodyMd: postTranslations.bodyMd,
          seoTitle: postTranslations.seoTitle,
          seoDescription: postTranslations.seoDescription,
          ingredients: postTranslations.ingredientsJson,
          instructions: postTranslations.instructionsJson,
          keywords: postTranslations.keywordsJson,
          cuisine: postTranslations.cuisine,
          baseServings: posts.baseServings,
          featuredProductId: posts.featuredProductId,
          updatedAt: postTranslations.updatedAt,
        })
        .from(postTranslations)
        .innerJoin(posts, eq(posts.id, postTranslations.postId))
        .where(and(isPublic, eq(postTranslations.locale, locale), eq(postTranslations.slug, slug)))
        .limit(1);
      return rows[0] ?? null;
    },

    async listPublishedAlternates(postId) {
      return db
        .select({ locale: postTranslations.locale, slug: postTranslations.slug })
        .from(postTranslations)
        .innerJoin(posts, eq(posts.id, postTranslations.postId))
        .where(and(isPublic, eq(postTranslations.postId, postId)));
    },
  };
}
