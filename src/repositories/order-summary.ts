import { eq } from 'drizzle-orm';
import { orders, products, productTranslations, productVariants } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Currency, Locale } from '@/validators/content';
import type { OrderStatus } from './orders';

/** What the buyer's status/test-checkout screens show. Never includes the email. */
export interface OrderSummary {
  id: string;
  status: OrderStatus;
  currency: Currency | null;
  amountTotal: number | null;
  downloadCount: number;
  maxDownloads: number;
  variant: {
    id: string;
    contentLocale: Locale;
    lsVariantId: string | null;
    paddlePriceId: string | null;
    priceTry: number;
    priceUsd: number;
    priceSar: number;
  };
  product: { slug: string; titles: { locale: Locale; title: string }[] };
}

export interface OrderSummaryRepo {
  find(orderId: string): Promise<OrderSummary | null>;
}

export function createOrderSummaryRepo(db: Db): OrderSummaryRepo {
  return {
    async find(orderId) {
      const [row] = await db
        .select({
          id: orders.id,
          status: orders.status,
          currency: orders.currency,
          amountTotal: orders.amountTotal,
          downloadCount: orders.downloadCount,
          maxDownloads: orders.maxDownloads,
          variantId: productVariants.id,
          contentLocale: productVariants.contentLocale,
          lsVariantId: productVariants.lsVariantId,
          paddlePriceId: productVariants.paddlePriceId,
          priceTry: productVariants.priceTry,
          priceUsd: productVariants.priceUsd,
          priceSar: productVariants.priceSar,
          productId: products.id,
          slug: products.slug,
        })
        .from(orders)
        .innerJoin(productVariants, eq(orders.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!row) return null;
      const titles = await db
        .select({ locale: productTranslations.locale, title: productTranslations.title })
        .from(productTranslations)
        .where(eq(productTranslations.productId, row.productId));
      return {
        id: row.id,
        status: row.status,
        currency: row.currency,
        amountTotal: row.amountTotal,
        downloadCount: row.downloadCount,
        maxDownloads: row.maxDownloads,
        variant: {
          id: row.variantId,
          contentLocale: row.contentLocale,
          lsVariantId: row.lsVariantId,
          paddlePriceId: row.paddlePriceId,
          priceTry: row.priceTry,
          priceUsd: row.priceUsd,
          priceSar: row.priceSar,
        },
        product: { slug: row.slug, titles },
      };
    },
  };
}
