import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { products, productTranslations, productVariants } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Locale } from '@/validators/content';

export type PaymentProviderId = 'lemonsqueezy' | 'paddle';
export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductTranslation {
  locale: Locale;
  title: string;
  subtitle: string | null;
  descriptionMd: string;
  coverAlt: string | null;
}

export interface VariantRecord {
  id: string;
  productId: string;
  contentLocale: Locale;
  sku: string;
  priceTry: number;
  priceUsd: number;
  priceSar: number;
  lsVariantId: string | null;
  paddlePriceId: string | null;
  isActive: boolean;
}

export interface ProductRecord {
  id: string;
  slug: string;
  status: ProductStatus;
  coverImageKey: string | null;
  pageCount: number | null;
  /** Translations for the requested locale and the `tr` fallback (whichever exist). */
  translations: ProductTranslation[];
  /** Active variants only. */
  variants: VariantRecord[];
}

export interface VariantFile {
  variantId: string;
  pdfR2Key: string | null;
  productSlug: string;
  contentLocale: Locale;
}

export interface ProductsRepo {
  listActive(locale: Locale): Promise<ProductRecord[]>;
  findActiveBySlugs(locale: Locale, slugs: readonly string[]): Promise<ProductRecord[]>;
  findVariantForCheckout(variantId: string): Promise<(VariantRecord & { productStatus: ProductStatus }) | null>;
  findVariantIdByProviderRef(provider: PaymentProviderId, providerVariantId: string): Promise<string | null>;
  findVariantFile(variantId: string): Promise<VariantFile | null>;
}

const variantColumns = {
  id: productVariants.id,
  productId: productVariants.productId,
  contentLocale: productVariants.contentLocale,
  sku: productVariants.sku,
  priceTry: productVariants.priceTry,
  priceUsd: productVariants.priceUsd,
  priceSar: productVariants.priceSar,
  lsVariantId: productVariants.lsVariantId,
  paddlePriceId: productVariants.paddlePriceId,
  isActive: productVariants.isActive,
};

export function createProductsRepo(db: Db): ProductsRepo {
  async function hydrate(locale: Locale, where: SQL | undefined): Promise<ProductRecord[]> {
    const base = await db
      .select({
        id: products.id,
        slug: products.slug,
        status: products.status,
        coverImageKey: products.coverImageKey,
        pageCount: products.pageCount,
      })
      .from(products)
      .where(where)
      .orderBy(products.createdAt);
    if (base.length === 0) return [];
    const ids = base.map((p) => p.id);
    const locales: Locale[] = locale === 'tr' ? ['tr'] : [locale, 'tr'];
    const [translations, variants] = await Promise.all([
      db
        .select({
          productId: productTranslations.productId,
          locale: productTranslations.locale,
          title: productTranslations.title,
          subtitle: productTranslations.subtitle,
          descriptionMd: productTranslations.descriptionMd,
          coverAlt: productTranslations.coverAlt,
        })
        .from(productTranslations)
        .where(and(inArray(productTranslations.productId, ids), inArray(productTranslations.locale, locales))),
      db
        .select(variantColumns)
        .from(productVariants)
        .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true))),
    ]);
    return base.map((p) => ({
      ...p,
      translations: translations
        .filter((t) => t.productId === p.id)
        .map((t) => ({
          locale: t.locale,
          title: t.title,
          subtitle: t.subtitle,
          descriptionMd: t.descriptionMd,
          coverAlt: t.coverAlt,
        })),
      variants: variants.filter((v) => v.productId === p.id),
    }));
  }

  return {
    listActive(locale) {
      return hydrate(locale, eq(products.status, 'active'));
    },

    findActiveBySlugs(locale, slugs) {
      if (slugs.length === 0) return Promise.resolve([]);
      return hydrate(locale, and(eq(products.status, 'active'), inArray(products.slug, [...slugs])));
    },

    async findVariantForCheckout(variantId) {
      const rows = await db
        .select({ ...variantColumns, productStatus: products.status })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, variantId))
        .limit(1);
      return rows[0] ?? null;
    },

    async findVariantIdByProviderRef(provider, providerVariantId) {
      const col = provider === 'lemonsqueezy' ? productVariants.lsVariantId : productVariants.paddlePriceId;
      const rows = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(col, providerVariantId))
        .limit(1);
      return rows[0]?.id ?? null;
    },

    async findVariantFile(variantId) {
      const rows = await db
        .select({
          variantId: productVariants.id,
          pdfR2Key: productVariants.pdfR2Key,
          productSlug: products.slug,
          contentLocale: productVariants.contentLocale,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, variantId))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}
