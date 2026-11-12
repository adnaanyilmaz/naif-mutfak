import { describe, expect, it } from 'vitest';
import type { AnalyticsRepo, Cursor } from '@/repositories/analytics.repo';
import type { AuditEntry } from '@/repositories/audit';
import {
  csvCell,
  decodeCursor,
  encodeCursor,
  exportRowsCsv,
  getSalesDashboard,
  maskEmail,
  resolveRange,
  type AnalyticsDeps,
} from './analytics.service';

const now = new Date('2026-11-12T15:30:00Z');
const admin = { email: 'chef@naifmutfak.com', sub: 's', via: 'access' as const };

describe('resolveRange', () => {
  it('defaults to the last 30 days with daily buckets and an exclusive end', () => {
    const r = resolveRange({}, now);
    expect(r).toMatchObject({ from: '2026-10-14', to: '2026-11-12', bucket: 'day' });
    expect(typeof r !== 'string' && r.range.to.toISOString()).toBe('2026-11-13T00:00:00.000Z');
  });

  it('picks coarser buckets for long ranges and caps at 366 days', () => {
    expect(resolveRange({ from: '2026-01-01', to: '2026-04-30' }, now)).toMatchObject({ bucket: 'week' });
    expect(resolveRange({ from: '2025-11-12', to: '2026-11-12' }, now)).toMatchObject({ bucket: 'month' });
    expect(resolveRange({ from: '2025-11-11', to: '2026-11-12' }, now)).toBe('range_too_long');
    expect(resolveRange({ from: '2026-11-12', to: '2026-11-01' }, now)).toBe('range_inverted');
    expect(resolveRange({ from: '2026-11-01', to: '2026-11-12', bucket: 'month' }, now)).toMatchObject({ bucket: 'month' });
  });
});

describe('privacy helpers', () => {
  it('masks emails', () => {
    expect(maskEmail('ayse@example.com')).toBe('a***@example.com');
    expect(maskEmail('x')).toBe('***');
    expect(maskEmail(null)).toBeNull();
  });

  it('quotes CSV and neutralizes spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell(-1)).toBe('-1');
    expect(csvCell(null)).toBe('');
  });

  it('round-trips cursors and rejects tampering', () => {
    const c: Cursor = { createdAt: 1_762_000_000, id: '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b11' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor('not-base64!')).toBeNull();
    expect(decodeCursor(btoa("1' OR 1=1"))).toBeNull();
  });
});

function fakeAnalytics(over: Partial<AnalyticsRepo> = {}): AnalyticsRepo {
  return {
    grossByCurrency: async () => [
      { currency: 'USD', orders: 3, gross: 3600 },
      { currency: 'TRY', orders: 1, gross: 34900 },
    ],
    refundsByCurrency: async () => [{ currency: 'USD', refunds: 1, amount: 1200 }],
    revenueSeries: async () => [
      { period: '2026-11-10', currency: 'USD', gross: 1200, orders: 1 },
      { period: '2026-11-11', currency: 'TRY', gross: 34900, orders: 1 },
      { period: '2026-11-11', currency: 'USD', gross: 2400, orders: 2 },
    ],
    byEdition: async () => [],
    byBuyerLocale: async () => [],
    conversionCounts: async () => ({ paid: 4, stalePending: 1, failed: 0 }),
    ordersPage: async () => [],
    orderEmail: async () => null,
    webhookOutcomes: async () => [],
    failedWebhooks: async () => [],
    subscriberStatusCounts: async () => [],
    subscriberNet: async () => ({ created: 0, unsubscribed: 0 }),
    subscriberSeries: async () => [],
    subscribersByLocale: async () => [],
    subscribersBySource: async () => [],
    subscribersPage: async () => [],
    ...over,
  };
}

describe('getSalesDashboard', () => {
  it('keeps currencies separate and aligns series on shared periods', async () => {
    const deps: AnalyticsDeps = { analytics: fakeAnalytics(), audit: { record: async () => {} }, now: () => now };
    const range = resolveRange({ from: '2026-11-01', to: '2026-11-02' }, now);
    if (typeof range === 'string') throw new Error(range);
    const dash = await getSalesDashboard(deps, range);
    expect(dash.kpis.map((k) => [k.currency, k.gross, k.refunds])).toEqual([
      ['TRY', 34900, 0],
      ['USD', 3600, 1],
      ['SAR', 0, 0],
    ]);
    expect(dash.kpis[1]?.refundRate).toBe(0.25);
    expect(dash.periods).toEqual(['2026-11-10', '2026-11-11']);
    expect(dash.revenue).toEqual([
      { currency: 'TRY', points: [{ period: '2026-11-10', value: 0 }, { period: '2026-11-11', value: 34900 }] },
      { currency: 'USD', points: [{ period: '2026-11-10', value: 1200 }, { period: '2026-11-11', value: 2400 }] },
    ]);
    expect(dash.conversion.rate).toBe(0.8);
  });
});

describe('exportRowsCsv', () => {
  const rows = Array.from({ length: 501 }, (_, i) => ({ id: `id-${i}`, createdAt: new Date(1_762_000_000_000 - i * 1000), email: `user${i}@example.com` }));

  async function collect(unmasked: boolean) {
    const audits: AuditEntry[] = [];
    const cursors: (Cursor | null)[] = [];
    const deps: AnalyticsDeps = { analytics: fakeAnalytics(), audit: { record: async (e) => void audits.push(e) }, now: () => now };
    let out = '';
    for await (const line of exportRowsCsv(deps, admin, {
      kind: 'orders',
      unmasked,
      header: ['id', 'email'],
      page: async (cursor, limit) => {
        cursors.push(cursor);
        const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + 1 : 0;
        return rows.slice(start, start + limit);
      },
      toCells: (r, email) => [r.id, email],
    })) {
      out += line;
    }
    return { out, audits, cursors };
  }

  it('streams every page with masked emails and no audit', async () => {
    const { out, audits, cursors } = await collect(false);
    const lines = out.trimEnd().split('\r\n');
    expect(lines).toHaveLength(502);
    expect(lines[1]).toBe('id-0,u***@example.com');
    expect(cursors).toHaveLength(2);
    expect(audits).toEqual([]);
  });

  it('audits unmasked exports before the first row', async () => {
    const { out, audits } = await collect(true);
    expect(out).toContain('id-0,user0@example.com');
    expect(audits).toEqual([expect.objectContaining({ action: 'export.orders.unmasked', actorEmail: admin.email })]);
  });
});
