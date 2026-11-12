// Read-only aggregate queries for /admin/analytics (admin.md §4). SELECT only, parameterized.
import { and, count, desc, eq, gte, isNotNull, lt, or, sql, sum, type AnyColumn } from 'drizzle-orm';
import { orders, products, productVariants, subscribers, webhookEvents } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Currency, Locale } from '@/validators/content';

export interface DateRange {
  /** Inclusive. */
  from: Date;
  /** Exclusive. */
  to: Date;
}

export type Bucket = 'day' | 'week' | 'month';
export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed' | 'bounced';
export type SubscriberSource = 'footer' | 'recipe_card' | 'ebook_callout' | 'popup' | 'checkout';

export interface Cursor {
  createdAt: number;
  id: string;
}

export interface OrderFilters {
  range: DateRange;
  status: OrderStatus | null;
  provider: 'lemonsqueezy' | 'paddle' | null;
  currency: Currency | null;
  productId: string | null;
}

export interface OrderRow {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  provider: 'lemonsqueezy' | 'paddle';
  currency: Currency | null;
  amountTotal: number | null;
  email: string | null;
  customerLocale: Locale;
  productSlug: string;
  contentLocale: Locale;
}

export interface SubscriberFilters {
  range: DateRange;
  status: SubscriberStatus | null;
  locale: Locale | null;
  source: SubscriberSource | null;
}

export interface SubscriberRow {
  id: string;
  createdAt: Date;
  email: string;
  status: SubscriberStatus;
  locale: Locale;
  source: SubscriberSource;
  confirmedAt: Date | null;
}

const FORMATS: Record<Bucket, string> = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m' };
const num = (v: unknown) => Number(v ?? 0);

function inRange(column: AnyColumn, r: DateRange) {
  return and(gte(column, r.from), lt(column, r.to));
}

function period(column: AnyColumn, bucket: Bucket) {
  return sql<string>`strftime(${FORMATS[bucket]}, ${column}, 'unixepoch')`;
}

function afterCursor(createdAt: AnyColumn, id: AnyColumn, c: Cursor | null) {
  if (!c) return undefined;
  const at = new Date(c.createdAt * 1000);
  return or(lt(createdAt, at), and(eq(createdAt, at), lt(id, c.id)));
}

export function createAnalyticsRepo(db: Db) {
  return {
    /** Paid orders per currency (by paid_at). Never summed across currencies. */
    async grossByCurrency(r: DateRange) {
      const rows = await db
        .select({ currency: orders.currency, orders: count(), gross: sum(orders.amountTotal) })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), isNotNull(orders.currency), inRange(orders.paidAt, r)))
        .groupBy(orders.currency);
      return rows.flatMap((x) => (x.currency ? [{ currency: x.currency, orders: x.orders, gross: num(x.gross) }] : []));
    },

    /** Refunds by refunded_at. */
    async refundsByCurrency(r: DateRange) {
      const rows = await db
        .select({ currency: orders.currency, refunds: count(), amount: sum(orders.amountTotal) })
        .from(orders)
        .where(and(eq(orders.status, 'refunded'), isNotNull(orders.currency), gte(orders.refundedAt, r.from), lt(orders.refundedAt, r.to)))
        .groupBy(orders.currency);
      return rows.flatMap((x) => (x.currency ? [{ currency: x.currency, refunds: x.refunds, amount: num(x.amount) }] : []));
    },

    async revenueSeries(r: DateRange, bucket: Bucket) {
      const p = period(orders.paidAt, bucket);
      const rows = await db
        .select({ period: p, currency: orders.currency, gross: sum(orders.amountTotal), orders: count() })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), isNotNull(orders.currency), inRange(orders.paidAt, r)))
        .groupBy(p, orders.currency)
        .orderBy(p);
      return rows.flatMap((x) => (x.currency ? [{ period: x.period, currency: x.currency, gross: num(x.gross), orders: x.orders }] : []));
    },

    async byEdition(r: DateRange) {
      const rows = await db
        .select({
          productId: products.id,
          slug: products.slug,
          contentLocale: productVariants.contentLocale,
          currency: orders.currency,
          orders: count(),
          gross: sum(orders.amountTotal),
        })
        .from(orders)
        .innerJoin(productVariants, eq(orders.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(eq(orders.status, 'paid'), inRange(orders.paidAt, r)))
        .groupBy(products.id, productVariants.contentLocale, orders.currency)
        .orderBy(desc(count()));
      return rows.map((x) => ({ ...x, gross: num(x.gross) }));
    },

    async byBuyerLocale(r: DateRange) {
      return db
        .select({ locale: orders.customerLocale, orders: count() })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), inRange(orders.paidAt, r)))
        .groupBy(orders.customerLocale);
    },

    /** Orders created in range: paid (incl. later refunded), stale pending (> 1h), failed. */
    async conversionCounts(r: DateRange, staleBefore: Date) {
      const [row] = await db
        .select({
          paid: sql<number>`sum(CASE WHEN ${orders.status} IN ('paid', 'refunded') THEN 1 ELSE 0 END)`.mapWith(Number),
          stalePending: sql<number>`sum(CASE WHEN ${orders.status} = 'pending' AND ${orders.createdAt} < ${Math.floor(staleBefore.getTime() / 1000)} THEN 1 ELSE 0 END)`.mapWith(Number),
          failed: sql<number>`sum(CASE WHEN ${orders.status} = 'failed' THEN 1 ELSE 0 END)`.mapWith(Number),
        })
        .from(orders)
        .where(inRange(orders.createdAt, r));
      return { paid: num(row?.paid), stalePending: num(row?.stalePending), failed: num(row?.failed) };
    },

    async ordersPage(f: OrderFilters, cursor: Cursor | null, limit: number): Promise<OrderRow[]> {
      return db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          status: orders.status,
          provider: orders.provider,
          currency: orders.currency,
          amountTotal: orders.amountTotal,
          email: orders.email,
          customerLocale: orders.customerLocale,
          productSlug: products.slug,
          contentLocale: productVariants.contentLocale,
        })
        .from(orders)
        .innerJoin(productVariants, eq(orders.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(
          and(
            inRange(orders.createdAt, f.range),
            f.status ? eq(orders.status, f.status) : undefined,
            f.provider ? eq(orders.provider, f.provider) : undefined,
            f.currency ? eq(orders.currency, f.currency) : undefined,
            f.productId ? eq(products.id, f.productId) : undefined,
            afterCursor(orders.createdAt, orders.id, cursor),
          ),
        )
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(limit);
    },

    async orderEmail(orderId: string) {
      const [row] = await db.select({ email: orders.email }).from(orders).where(eq(orders.id, orderId)).limit(1);
      return row?.email ?? null;
    },

    async webhookOutcomes(since: Date) {
      return db
        .select({ outcome: webhookEvents.outcome, count: count() })
        .from(webhookEvents)
        .where(gte(webhookEvents.receivedAt, since))
        .groupBy(webhookEvents.outcome);
    },

    async failedWebhooks(since: Date, limit: number) {
      return db
        .select({
          id: webhookEvents.id,
          provider: webhookEvents.provider,
          eventName: webhookEvents.eventName,
          error: webhookEvents.error,
          orderId: webhookEvents.orderId,
          receivedAt: webhookEvents.receivedAt,
        })
        .from(webhookEvents)
        .where(and(eq(webhookEvents.outcome, 'failed'), gte(webhookEvents.receivedAt, since)))
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(limit);
    },

    async subscriberStatusCounts() {
      return db.select({ status: subscribers.status, count: count() }).from(subscribers).groupBy(subscribers.status);
    },

    async subscriberNet(r: DateRange) {
      const [created] = await db.select({ n: count() }).from(subscribers).where(inRange(subscribers.createdAt, r));
      const [left] = await db
        .select({ n: count() })
        .from(subscribers)
        .where(and(gte(subscribers.unsubscribedAt, r.from), lt(subscribers.unsubscribedAt, r.to)));
      return { created: created?.n ?? 0, unsubscribed: left?.n ?? 0 };
    },

    async subscriberSeries(r: DateRange, bucket: Bucket) {
      const p = period(subscribers.createdAt, bucket);
      return db
        .select({ period: p, status: subscribers.status, count: count() })
        .from(subscribers)
        .where(inRange(subscribers.createdAt, r))
        .groupBy(p, subscribers.status)
        .orderBy(p);
    },

    async subscribersByLocale(r: DateRange) {
      return db
        .select({ locale: subscribers.locale, count: count() })
        .from(subscribers)
        .where(inRange(subscribers.createdAt, r))
        .groupBy(subscribers.locale);
    },

    async subscribersBySource(r: DateRange) {
      const rows = await db
        .select({
          source: subscribers.source,
          total: count(),
          confirmed: sql<number>`sum(CASE WHEN ${subscribers.confirmedAt} IS NOT NULL THEN 1 ELSE 0 END)`.mapWith(Number),
        })
        .from(subscribers)
        .where(inRange(subscribers.createdAt, r))
        .groupBy(subscribers.source);
      return rows.map((x) => ({ ...x, confirmed: num(x.confirmed) }));
    },

    async subscribersPage(f: SubscriberFilters, cursor: Cursor | null, limit: number): Promise<SubscriberRow[]> {
      return db
        .select({
          id: subscribers.id,
          createdAt: subscribers.createdAt,
          email: subscribers.email,
          status: subscribers.status,
          locale: subscribers.locale,
          source: subscribers.source,
          confirmedAt: subscribers.confirmedAt,
        })
        .from(subscribers)
        .where(
          and(
            inRange(subscribers.createdAt, f.range),
            f.status ? eq(subscribers.status, f.status) : undefined,
            f.locale ? eq(subscribers.locale, f.locale) : undefined,
            f.source ? eq(subscribers.source, f.source) : undefined,
            afterCursor(subscribers.createdAt, subscribers.id, cursor),
          ),
        )
        .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
        .limit(limit);
    },
  };
}

export type AnalyticsRepo = ReturnType<typeof createAnalyticsRepo>;
