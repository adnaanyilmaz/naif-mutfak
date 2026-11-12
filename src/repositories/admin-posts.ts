import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { posts, postTranslations } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Ingredients, Instructions, Locale } from '@/validators/content';
import { auditInsert, type AuditEntry } from './audit';
import { isGuardViolation, isUniqueViolation } from './db-errors';
import { guardUpdatedAt } from './guards';

export type PostStatus = 'draft' | 'published' | 'archived';
export type Difficulty = 'easy' | 'medium' | 'advanced';

export interface AdminPostListItem {
  id: string;
  status: PostStatus;
  category: string;
  updatedAt: Date;
  translations: { locale: Locale; title: string; slug: string; isPublished: boolean }[];
}

export interface AdminPostShared {
  status: PostStatus;
  category: string;
  isRecipe: boolean;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  baseServings: number | null;
  difficulty: Difficulty | null;
  featuredProductId: string | null;
}

export interface AdminTranslation {
  locale: Locale;
  slug: string;
  title: string;
  dek: string | null;
  bodyMd: string;
  heroImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ingredients: Ingredients | null;
  instructions: Instructions | null;
  keywords: string[];
  cuisine: string | null;
  isPublished: boolean;
}

export interface AdminPostRecord extends AdminPostShared {
  id: string;
  heroImageKey: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  translations: AdminTranslation[];
}

export interface SavePostWrite {
  postId: string;
  expectedUpdatedAt: Date;
  nextUpdatedAt: Date;
  /** Set `published_at` when still null (first publish). */
  publishAt: Date | null;
  post: AdminPostShared;
  translations: AdminTranslation[];
  audit: AuditEntry;
}

export type SavePostOutcome = 'saved' | 'conflict' | 'slug_taken';

export interface AdminPostsRepo {
  list(): Promise<AdminPostListItem[]>;
  find(id: string): Promise<AdminPostRecord | null>;
  createDraft(input: { id: string; category: string }, audit: AuditEntry): Promise<void>;
  isSlugTaken(locale: Locale, slug: string, excludePostId: string): Promise<boolean>;
  save(write: SavePostWrite): Promise<SavePostOutcome>;
  /** Upload finalize: swaps the hero key without touching `updated_at` (editor concurrency token). */
  setHeroImage(postId: string, key: string, audit: AuditEntry): Promise<{ previousKey: string | null } | null>;
  exists(postId: string): Promise<boolean>;
}

const sharedColumns = {
  status: posts.status,
  category: posts.category,
  isRecipe: posts.isRecipe,
  prepMinutes: posts.prepMinutes,
  cookMinutes: posts.cookMinutes,
  restMinutes: posts.restMinutes,
  baseServings: posts.baseServings,
  difficulty: posts.difficulty,
  featuredProductId: posts.featuredProductId,
};

export function createAdminPostsRepo(db: Db): AdminPostsRepo {
  return {
    async list() {
      const rows = await db
        .select({ id: posts.id, status: posts.status, category: posts.category, updatedAt: posts.updatedAt })
        .from(posts)
        .orderBy(desc(posts.updatedAt));
      const translations = await db
        .select({
          postId: postTranslations.postId,
          locale: postTranslations.locale,
          title: postTranslations.title,
          slug: postTranslations.slug,
          isPublished: postTranslations.isPublished,
        })
        .from(postTranslations);
      return rows.map((p) => ({
        ...p,
        translations: translations.filter((t) => t.postId === p.id).map(({ postId: _p, ...t }) => t),
      }));
    },

    async find(id) {
      const [post] = await db
        .select({ id: posts.id, heroImageKey: posts.heroImageKey, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt, ...sharedColumns })
        .from(posts)
        .where(eq(posts.id, id))
        .limit(1);
      if (!post) return null;
      const rows = await db.select().from(postTranslations).where(eq(postTranslations.postId, id));
      return {
        ...post,
        translations: rows.map((t) => ({
          locale: t.locale,
          slug: t.slug,
          title: t.title,
          dek: t.dek,
          bodyMd: t.bodyMd,
          heroImageAlt: t.heroImageAlt,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
          ingredients: t.ingredientsJson,
          instructions: t.instructionsJson,
          keywords: t.keywordsJson ?? [],
          cuisine: t.cuisine,
          isPublished: t.isPublished,
        })),
      };
    },

    async createDraft({ id, category }, audit) {
      await db.batch([db.insert(posts).values({ id, category, status: 'draft' }), auditInsert(db, audit)]);
    },

    async isSlugTaken(locale, slug, excludePostId) {
      const rows = await db
        .select({ id: postTranslations.id })
        .from(postTranslations)
        .where(and(eq(postTranslations.locale, locale), eq(postTranslations.slug, slug), ne(postTranslations.postId, excludePostId)))
        .limit(1);
      return rows.length > 0;
    },

    async save(w) {
      const stmts: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
        guardUpdatedAt(db, 'posts', w.postId, w.expectedUpdatedAt),
        db
          .update(posts)
          .set({
            ...w.post,
            updatedAt: w.nextUpdatedAt,
            ...(w.publishAt ? { publishedAt: sql`COALESCE(${posts.publishedAt}, ${Math.floor(w.publishAt.getTime() / 1000)})` } : {}),
          })
          .where(eq(posts.id, w.postId)),
      ];
      for (const t of w.translations) {
        const values = {
          slug: t.slug,
          title: t.title,
          dek: t.dek,
          bodyMd: t.bodyMd,
          heroImageAlt: t.heroImageAlt,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
          ingredientsJson: t.ingredients,
          instructionsJson: t.instructions,
          keywordsJson: t.keywords,
          cuisine: t.cuisine,
          isPublished: t.isPublished,
        };
        stmts.push(
          db
            .insert(postTranslations)
            .values({ postId: w.postId, locale: t.locale, ...values })
            .onConflictDoUpdate({
              target: [postTranslations.postId, postTranslations.locale],
              set: { ...values, updatedAt: w.nextUpdatedAt },
            }),
        );
      }
      stmts.push(auditInsert(db, w.audit));
      try {
        await db.batch(stmts);
        return 'saved';
      } catch (err) {
        if (isGuardViolation(err)) return 'conflict';
        if (isUniqueViolation(err, 'post_translations.locale')) return 'slug_taken';
        throw err;
      }
    },

    async setHeroImage(postId, key, audit) {
      const [row] = await db.select({ previousKey: posts.heroImageKey }).from(posts).where(eq(posts.id, postId)).limit(1);
      if (!row) return null;
      await db.batch([
        db.update(posts).set({ heroImageKey: key, updatedAt: sql`${posts.updatedAt}` }).where(eq(posts.id, postId)),
        auditInsert(db, audit),
      ]);
      return { previousKey: row.previousKey };
    },

    async exists(postId) {
      const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
      return rows.length > 0;
    },
  };
}
