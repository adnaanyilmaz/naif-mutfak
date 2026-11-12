// Read-only sales & audience analytics (admin.md §4). Revenue is never summed across currencies.
import type {
  AnalyticsRepo,
  Bucket,
  Cursor,
  DateRange,
  OrderFilters,
  OrderRow,
  SubscriberFilters,
  SubscriberRow,
} from '@/repositories/analytics.repo';
import type { AuditRepo } from '@/repositories/audit';
import { base64UrlDecode, base64UrlEncode } from '@/lib/cloudflare/crypto';
import type { SalesQuery, SubscribersQuery } from '@/validators/admin/analytics';
import { CURRENCIES, type Currency, type Locale } from '@/validators/content';
import type { AdminIdentity } from './auth.service';
import { createTtlCache } from './ttl-cache';

export interface AnalyticsDeps {
  analytics: AnalyticsRepo;
  audit: AuditRepo;
  now: () => Date;
}

const DAY = 86_400_000;
export const MAX_RANGE_DAYS = 366;
export const PAGE_SIZE = 25;
const CACHE_MS = 60_000;

export type RangeError = 'range_too_long' | 'range_inverted';

export interface ResolvedRange {
  range: DateRange;
  /** Inclusive dates for the form (YYYY-MM-DD, UTC). */
  from: string;
  to: string;
  bucket: Bucket;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Default: last 30 days. `to` is an inclusive date → exclusive next-day bound. */
export function resolveRange(
  q: { from?: string | undefined; to?: string | undefined; bucket?: Bucket | undefined },
  now: Date,
): ResolvedRange | RangeError {
  const today = new Date(`${isoDay(now)}T00:00:00Z`);
  const to = q.to ? new Date(`${q.to}T00:00:00Z`) : today;
  const from = q.from ? new Date(`${q.from}T00:00:00Z`) : new Date(to.getTime() - 29 * DAY);
  if (from > to) return 'range_inverted';
  const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  if (days > MAX_RANGE_DAYS) return 'range_too_long';
  const bucket = q.bucket ?? (days <= 31 ? 'day' : days <= 180 ? 'week' : 'month');
  return { range: { from, to: new Date(to.getTime() + DAY) }, from: isoDay(from), to: isoDay(to), bucket };
}

/** `ayse@example.com` → `a***@example.com`. */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function encodeCursor(c: Cursor): string {
  return base64UrlEncode(new TextEncoder().encode(`${c.createdAt}:${c.id}`));
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const bytes = base64UrlDecode(raw);
    if (!bytes) return null;
    const text = new TextDecoder().decode(bytes);
    const m = /^(\d{1,12}):([0-9a-zA-Z-]{1,64})$/.exec(text);
    return m?.[1] && m[2] ? { createdAt: Number(m[1]), id: m[2] } : null;
  } catch {
    return null;
  }
}

/** Repos are asked for limit + 1 rows; the extra row only signals that another page exists. */
function paginate<T extends { createdAt: Date; id: string }>(rows: T[], limit: number): { page: T[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    page,
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: Math.floor(last.createdAt.getTime() / 1000), id: last.id }) : null,
  };
}

/* ───────────── Sales ───────────── */

export interface CurrencyKpi {
  currency: Currency;
  orders: number;
  gross: number;
  refunds: number;
  refundAmount: number;
  /** refunds / (orders + refunds) in range; null when no data. */
  refundRate: number | null;
}

export interface SeriesPoint {
  period: string;
  value: number;
}

export interface SalesDashboard {
  kpis: CurrencyKpi[];
  revenue: { currency: Currency; points: SeriesPoint[] }[];
  periods: string[];
  byEdition: { slug: string; contentLocale: Locale; currency: Currency | null; orders: number; gross: number }[];
  byBuyerLocale: { locale: Locale; orders: number }[];
  conversion: { paid: number; stalePending: number; failed: number; rate: number | null };
  webhooks: { outcomes: { outcome: string; count: number }[]; failed: { id: number; provider: string; eventName: string; error: string | null; receivedAt: Date }[] };
}

export type MaskedOrderRow = Omit<OrderRow, 'email'> & { email: string | null };

const salesCache = createTtlCache<SalesDashboard>(CACHE_MS);

function rangeKey(r: DateRange) {
  return `${r.from.getTime()}-${r.to.getTime()}`;
}

/** Fill every period with a value per currency so lines share an x-axis. */
function periodsBetween(points: { period: string }[]): string[] {
  return [...new Set(points.map((p) => p.period))].sort();
}

export async function getSalesDashboard(deps: AnalyticsDeps, resolved: ResolvedRange): Promise<SalesDashboard> {
  const { range, bucket } = resolved;
  return salesCache(`sales:${rangeKey(range)}:${bucket}`, async () => {
    const now = deps.now();
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const [gross, refunds, series, byEdition, byBuyerLocale, conversion, outcomes, failed] = await Promise.all([
      deps.analytics.grossByCurrency(range),
      deps.analytics.refundsByCurrency(range),
      deps.analytics.revenueSeries(range, bucket),
      deps.analytics.byEdition(range),
      deps.analytics.byBuyerLocale(range),
      deps.analytics.conversionCounts(range, new Date(now.getTime() - 3_600_000)),
      deps.analytics.webhookOutcomes(weekAgo),
      deps.analytics.failedWebhooks(weekAgo, 20),
    ]);

    const kpis = CURRENCIES.map((currency): CurrencyKpi => {
      const g = gross.find((x) => x.currency === currency);
      const r = refunds.find((x) => x.currency === currency);
      const orders = g?.orders ?? 0;
      const refundCount = r?.refunds ?? 0;
      return {
        currency,
        orders,
        gross: g?.gross ?? 0,
        refunds: refundCount,
        refundAmount: r?.amount ?? 0,
        refundRate: orders + refundCount > 0 ? refundCount / (orders + refundCount) : null,
      };
    });

    const periods = periodsBetween(series);
    const revenue = CURRENCIES.filter((c) => series.some((s) => s.currency === c)).map((currency) => ({
      currency,
      points: periods.map((period) => ({
        period,
        value: series.find((s) => s.currency === currency && s.period === period)?.gross ?? 0,
      })),
    }));

    const denominator = conversion.paid + conversion.stalePending + conversion.failed;
    return {
      kpis,
      revenue,
      periods,
      byEdition: byEdition.map(({ productId: _id, ...e }) => e),
      byBuyerLocale,
      conversion: { ...conversion, rate: denominator > 0 ? conversion.paid / denominator : null },
      webhooks: { outcomes, failed: failed.map(({ orderId: _o, ...f }) => f) },
    };
  });
}

export function orderFilters(q: SalesQuery, range: DateRange): OrderFilters {
  return {
    range,
    status: q.status ?? null,
    provider: q.provider ?? null,
    currency: q.currency ?? null,
    productId: q.product ?? null,
  };
}

export async function listOrders(
  deps: AnalyticsDeps,
  filters: OrderFilters,
  cursor: string | undefined,
): Promise<{ rows: MaskedOrderRow[]; nextCursor: string | null }> {
  const { page, nextCursor } = paginate(await deps.analytics.ordersPage(filters, decodeCursor(cursor), PAGE_SIZE + 1), PAGE_SIZE);
  return { rows: page.map((r) => ({ ...r, email: maskEmail(r.email) })), nextCursor };
}

/** Explicit "reveal" of one buyer email, audited. */
export async function revealOrderEmail(deps: AnalyticsDeps, actor: AdminIdentity, orderId: string): Promise<string | null> {
  const email = await deps.analytics.orderEmail(orderId);
  if (email) {
    await deps.audit.record({ actorEmail: actor.email, action: 'order.reveal_email', entityType: 'order', entityId: orderId, diff: null });
  }
  return email;
}

/* ───────────── Subscribers ───────────── */

export interface SubscribersDashboard {
  status: Record<'active' | 'pending' | 'unsubscribed' | 'bounced', number>;
  net: { created: number; unsubscribed: number; growth: number };
  periods: string[];
  growth: { status: string; points: SeriesPoint[] }[];
  byLocale: { locale: Locale; count: number }[];
  bySource: { source: string; total: number; confirmed: number; confirmationRate: number | null }[];
}

const subscribersCache = createTtlCache<SubscribersDashboard>(CACHE_MS);

export async function getSubscribersDashboard(deps: AnalyticsDeps, resolved: ResolvedRange): Promise<SubscribersDashboard> {
  const { range, bucket } = resolved;
  return subscribersCache(`subs:${rangeKey(range)}:${bucket}`, async () => {
    const [statusRows, net, series, byLocale, bySource] = await Promise.all([
      deps.analytics.subscriberStatusCounts(),
      deps.analytics.subscriberNet(range),
      deps.analytics.subscriberSeries(range, bucket),
      deps.analytics.subscribersByLocale(range),
      deps.analytics.subscribersBySource(range),
    ]);
    const statusCount = (s: string) => statusRows.find((r) => r.status === s)?.count ?? 0;
    const periods = periodsBetween(series);
    const statuses = [...new Set(series.map((s) => s.status))];
    return {
      status: {
        active: statusCount('active'),
        pending: statusCount('pending'),
        unsubscribed: statusCount('unsubscribed'),
        bounced: statusCount('bounced'),
      },
      net: { ...net, growth: net.created - net.unsubscribed },
      periods,
      growth: statuses.map((status) => ({
        status,
        points: periods.map((period) => ({
          period,
          value: series.find((s) => s.status === status && s.period === period)?.count ?? 0,
        })),
      })),
      byLocale,
      bySource: bySource.map((s) => ({ ...s, confirmationRate: s.total > 0 ? s.confirmed / s.total : null })),
    };
  });
}

export function subscriberFilters(q: SubscribersQuery, range: DateRange): SubscriberFilters {
  return { range, status: q.status ?? null, locale: q.locale ?? null, source: q.source ?? null };
}

export type MaskedSubscriberRow = Omit<SubscriberRow, 'email'> & { email: string | null };

export async function listSubscribers(
  deps: AnalyticsDeps,
  filters: SubscriberFilters,
  cursor: string | undefined,
): Promise<{ rows: MaskedSubscriberRow[]; nextCursor: string | null }> {
  const { page, nextCursor } = paginate(await deps.analytics.subscribersPage(filters, decodeCursor(cursor), PAGE_SIZE + 1), PAGE_SIZE);
  return { rows: page.map((r) => ({ ...r, email: maskEmail(r.email) })), nextCursor };
}

/* ───────────── CSV export ───────────── */

/** RFC 4180 quoting + spreadsheet formula-injection guard (=, +, -, @, tab, CR prefixes). */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function csvLine(values: (string | number | null)[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

const EXPORT_BATCH = 500;

/** Streams every row of the filtered table, page by page. Unmasked exports are audited first. */
export async function* exportRowsCsv<Row extends { createdAt: Date; id: string; email: string | null }>(
  deps: AnalyticsDeps,
  actor: AdminIdentity,
  opts: {
    kind: 'orders' | 'subscribers';
    unmasked: boolean;
    header: string[];
    page: (cursor: Cursor | null, limit: number) => Promise<Row[]>;
    toCells: (row: Row, email: string | null) => (string | number | null)[];
  },
): AsyncGenerator<string> {
  if (opts.unmasked) {
    await deps.audit.record({
      actorEmail: actor.email,
      action: `export.${opts.kind}.unmasked`,
      entityType: 'export',
      entityId: opts.kind,
      diff: null,
    });
  }
  yield csvLine(opts.header);
  let cursor: Cursor | null = null;
  for (;;) {
    const rows = await opts.page(cursor, EXPORT_BATCH);
    for (const row of rows) yield csvLine(opts.toCells(row, opts.unmasked ? row.email : maskEmail(row.email)));
    const last = rows.at(-1);
    if (rows.length < EXPORT_BATCH || !last) return;
    cursor = { createdAt: Math.floor(last.createdAt.getTime() / 1000), id: last.id };
  }
}

function toStream(lines: AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await lines.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      await lines.return(undefined);
    },
  });
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function ordersCsvStream(deps: AnalyticsDeps, actor: AdminIdentity, filters: OrderFilters, unmasked: boolean) {
  return toStream(
    exportRowsCsv(deps, actor, {
      kind: 'orders',
      unmasked,
      header: ['order_id', 'created_at', 'status', 'provider', 'product', 'edition', 'buyer_locale', 'currency', 'amount_total_minor', 'email'],
      page: (cursor, limit) => deps.analytics.ordersPage(filters, cursor, limit),
      toCells: (r, email) => [r.id, iso(r.createdAt), r.status, r.provider, r.productSlug, r.contentLocale, r.customerLocale, r.currency, r.amountTotal, email],
    }),
  );
}

export function subscribersCsvStream(deps: AnalyticsDeps, actor: AdminIdentity, filters: SubscriberFilters, unmasked: boolean) {
  return toStream(
    exportRowsCsv(deps, actor, {
      kind: 'subscribers',
      unmasked,
      header: ['subscriber_id', 'created_at', 'status', 'locale', 'source', 'confirmed_at', 'email'],
      page: (cursor, limit) => deps.analytics.subscribersPage(filters, cursor, limit),
      toCells: (r, email) => [r.id, iso(r.createdAt), r.status, r.locale, r.source, iso(r.confirmedAt), email],
    }),
  );
}
