import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { products, productTranslations, productVariants } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Locale } from '@/validators/content';
import { auditInsert, type AuditEntry } from './audit';
import { isGuardViolation, isUniqueViolation } from './db-errors';
import { guardUpdatedAt } from './guards';

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface AdminVariant {
  id: string;
  contentLocale: Locale;
  sku: string;
  priceTry: number;
  priceUsd: number;
  priceSar: number;
  lsVariantId: string | null;
  paddlePriceId: string | null;
  pdfR2Key: string | null;
  pdfSizeBytes: number | null;
  pdfSha256: string | null;
  isActive: boolean;
}

export interface AdminProductTranslation {
  locale: Locale;
  title: string;
  subtitle: string | null;
  descriptionMd: string;
  coverAlt: string | null;
}

export interface AdminProductRecord {
  id: string;
  slug: string;
  status: ProductStatus;
  pageCount: number | null;
  coverImageKey: string | null;
  updatedAt: Date;
  translations: AdminProductTranslation[];
  variants: AdminVariant[];
}

export interface AdminProductListItem {
  id: string;
  slug: string;
  status: ProductStatus;
  coverImageKey: string | null;
  pageCount: number | null;
  updatedAt: Date;
  titles: { locale: Locale; title: string }[];
  variants: { contentLocale: Locale; isActive: boolean; hasPdf: boolean; priceTry: number; lsVariantId: string | null; paddlePriceId: string | null }[];
}

export type VariantWrite = Omit<AdminVariant, 'pdfR2Key' | 'pdfSizeBytes' | 'pdfSha256'>;

export interface SaveProductWrite {
  productId: string;
  expectedUpdatedAt: Date;
  nextUpdatedAt: Date;
  product: { slug: string; status: ProductStatus; pageCount: number | null };
  translations: AdminProductTranslation[];
  variants: { value: VariantWrite; isNew: boolean }[];
  audit: AuditEntry;
}

export type SaveProductOutcome = 'saved' | 'conflict' | 'slug_taken' | 'sku_taken' | 'mor_taken' | 'edition_taken';

export interface PdfFile {
  key: string;
  sizeBytes: number;
  sha256: string;
}

export interface AdminProductsRepo {
  list(): Promise<AdminProductListItem[]>;
  find(id: string): Promise<AdminProductRecord | null>;
  createDraft(input: { id: string; slug: string }, audit: AuditEntry): Promise<void>;
  save(write: SaveProductWrite): Promise<SaveProductOutcome>;
  setCover(productId: string, key: string, audit: AuditEntry): Promise<{ previousKey: string | null } | null>;
  findVariantOwner(variantId: string): Promise<{ productId: string } | null>;
  /** New key written atomically; the old object is deleted by the caller afterwards (buyers keep working). */
  setVariantPdf(variantId: string, file: PdfFile, audit: AuditEntry): Promise<{ previousKey: string | null } | null>;
  /** Featured e-book select in the post editor. */
  listOptions(): Promise<{ id: string; slug: string }[]>;
}

export function createAdminProductsRepo(db: Db): AdminProductsRepo {
  return {
    async list() {
      const [rows, titles, variants] = await Promise.all([
        db
          .select({
            id: products.id,
            slug: products.slug,
            status: products.status,
            coverImageKey: products.coverImageKey,
            pageCount: products.pageCount,
            updatedAt: products.updatedAt,
          })
          .from(products)
          .orderBy(desc(products.updatedAt)),
        db
          .select({ productId: productTranslations.productId, locale: productTranslations.locale, title: productTranslations.title })
          .from(productTranslations),
        db
          .select({
            productId: productVariants.productId,
            contentLocale: productVariants.contentLocale,
            isActive: productVariants.isActive,
            pdfR2Key: productVariants.pdfR2Key,
            priceTry: productVariants.priceTry,
            lsVariantId: productVariants.lsVariantId,
            paddlePriceId: productVariants.paddlePriceId,
          })
          .from(productVariants),
      ]);
      return rows.map((p) => ({
        ...p,
        titles: titles.filter((t) => t.productId === p.id).map(({ locale, title }) => ({ locale, title })),
        variants: variants
          .filter((v) => v.productId === p.id)
          .map((v) => ({
            contentLocale: v.contentLocale,
            isActive: v.isActive,
            hasPdf: v.pdfR2Key !== null,
            priceTry: v.priceTry,
            lsVariantId: v.lsVariantId,
            paddlePriceId: v.paddlePriceId,
          })),
      }));
    },

    async find(id) {
      const [p] = await db
        .select({
          id: products.id,
          slug: products.slug,
          status: products.status,
          pageCount: products.pageCount,
          coverImageKey: products.coverImageKey,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(eq(products.id, id))
        .limit(1);
      if (!p) return null;
      const [translations, variants] = await Promise.all([
        db
          .select({
            locale: productTranslations.locale,
            title: productTranslations.title,
            subtitle: productTranslations.subtitle,
            descriptionMd: productTranslations.descriptionMd,
            coverAlt: productTranslations.coverAlt,
          })
          .from(productTranslations)
          .where(eq(productTranslations.productId, id)),
        db
          .select({
            id: productVariants.id,
            contentLocale: productVariants.contentLocale,
            sku: productVariants.sku,
            priceTry: productVariants.priceTry,
            priceUsd: productVariants.priceUsd,
            priceSar: productVariants.priceSar,
            lsVariantId: productVariants.lsVariantId,
            paddlePriceId: productVariants.paddlePriceId,
            pdfR2Key: productVariants.pdfR2Key,
            pdfSizeBytes: productVariants.pdfSizeBytes,
            pdfSha256: productVariants.pdfSha256,
            isActive: productVariants.isActive,
          })
          .from(productVariants)
          .where(eq(productVariants.productId, id))
          .orderBy(asc(productVariants.contentLocale)),
      ]);
      return { ...p, translations, variants };
    },

    async createDraft({ id, slug }, audit) {
      await db.batch([db.insert(products).values({ id, slug, status: 'draft' }), auditInsert(db, audit)]);
    },

    async save(w) {
      const stmts: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
        guardUpdatedAt(db, 'products', w.productId, w.expectedUpdatedAt),
        db
          .update(products)
          .set({ ...w.product, updatedAt: w.nextUpdatedAt })
          .where(eq(products.id, w.productId)),
      ];
      for (const t of w.translations) {
        const { locale, ...values } = t;
        stmts.push(
          db
            .insert(productTranslations)
            .values({ productId: w.productId, locale, ...values })
            .onConflictDoUpdate({ target: [productTranslations.productId, productTranslations.locale], set: values }),
        );
      }
      for (const { value, isNew } of w.variants) {
        const { id, ...values } = value;
        stmts.push(
          isNew
            ? db.insert(productVariants).values({ id, productId: w.productId, ...values })
            : db
                .update(productVariants)
                .set({ ...values, updatedAt: w.nextUpdatedAt })
                .where(and(eq(productVariants.id, id), eq(productVariants.productId, w.productId))),
        );
      }
      stmts.push(auditInsert(db, w.audit));
      try {
        await db.batch(stmts);
        return 'saved';
      } catch (err) {
        if (isGuardViolation(err)) return 'conflict';
        if (isUniqueViolation(err, 'products.slug')) return 'slug_taken';
        if (isUniqueViolation(err, 'product_variants.sku')) return 'sku_taken';
        if (isUniqueViolation(err, 'product_variants.product_id')) return 'edition_taken';
        if (isUniqueViolation(err, 'product_variants.ls_variant_id') || isUniqueViolation(err, 'product_variants.paddle_price_id')) {
          return 'mor_taken';
        }
        throw err;
      }
    },

    async setCover(productId, key, audit) {
      const [row] = await db
        .select({ previousKey: products.coverImageKey })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (!row) return null;
      await db.batch([
        // Keep updated_at: it is the editor's concurrency token.
        db.update(products).set({ coverImageKey: key, updatedAt: sql`${products.updatedAt}` }).where(eq(products.id, productId)),
        auditInsert(db, audit),
      ]);
      return { previousKey: row.previousKey };
    },

    async findVariantOwner(variantId) {
      const [row] = await db
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      return row ?? null;
    },

    async setVariantPdf(variantId, file, audit) {
      const [row] = await db
        .select({ previousKey: productVariants.pdfR2Key })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      if (!row) return null;
      await db.batch([
        db
          .update(productVariants)
          .set({ pdfR2Key: file.key, pdfSizeBytes: file.sizeBytes, pdfSha256: file.sha256 })
          .where(eq(productVariants.id, variantId)),
        auditInsert(db, audit),
      ]);
      return { previousKey: row.previousKey };
    },

    listOptions() {
      return db.select({ id: products.id, slug: products.slug }).from(products).orderBy(asc(products.slug));
    },
  };
}
