import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { FilterDate, FilterSelect, Kpi, Panel, withParams } from '@/components/admin/AnalyticsParts';
import { BarList } from '@/components/admin/charts/BarList';
import { LineChart } from '@/components/admin/charts/LineChart';
import { ADMIN_LOCALE, LOCALES } from '@/i18n/config';
import { getSubscribersDashboard, listSubscribers, resolveRange, subscriberFilters } from '@/services/admin/analytics.service';
import { analyticsDeps } from '@/services/container';
import { subscribersQuerySchema } from '@/validators/admin/analytics';
import { requireAdmin } from '../../_server/require-admin';

const STATUSES = ['active', 'pending', 'unsubscribed', 'bounced'] as const;
const SOURCES = ['footer', 'recipe_card', 'ebook_callout', 'popup', 'checkout'] as const;
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--color-olive)',
  pending: 'var(--color-butter)',
  unsubscribed: 'var(--color-muted)',
  bounced: 'var(--color-danger)',
};

const isStatus = (s: string): s is (typeof STATUSES)[number] => STATUSES.some((x) => x === s);
const isSource = (s: string): s is (typeof SOURCES)[number] => SOURCES.some((x) => x === s);

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' });
  const format = await getFormatter({ locale: ADMIN_LOCALE });
  const parsed = subscribersQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : {};
  const deps = analyticsDeps();
  const resolved = resolveRange(query, deps.now());
  if (typeof resolved === 'string') {
    return (
      <div className="mx-auto max-w-page">
        <h1 className="font-display text-h2">{t('analytics.subscribers.title')}</h1>
        <p role="alert" className="mt-6 text-danger">
          {t(`analytics.${resolved}`)}
        </p>
      </div>
    );
  }

  const [dash, table] = await Promise.all([
    getSubscribersDashboard(deps, resolved),
    listSubscribers(deps, subscriberFilters(query, resolved.range), query.cursor),
  ]);
  const pct = (v: number | null) => (v === null ? t('common.none') : format.number(v, { style: 'percent', maximumFractionDigits: 1 }));
  const statusLabel = (s: string) => (isStatus(s) ? t(`status.${s}`) : s);
  const sourceLabel = (s: string) => (isSource(s) ? t(`analytics.sources.${s}`) : s);
  const base: Record<string, string | undefined> = {
    from: resolved.from,
    to: resolved.to,
    bucket: query.bucket,
    status: query.status,
    locale: query.locale,
    source: query.source,
  };
  const any = { value: '', label: t('analytics.any') };

  return (
    <div className="mx-auto max-w-page space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-h2">{t('analytics.subscribers.title')}</h1>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <FilterDate name="from" label={t('analytics.from')} value={resolved.from} />
          <FilterDate name="to" label={t('analytics.to')} value={resolved.to} />
          <FilterSelect
            name="bucket"
            label={t('analytics.bucket')}
            value={query.bucket}
            options={[any, ...(['day', 'week', 'month'] as const).map((b) => ({ value: b, label: t(`analytics.${b}`) }))]}
          />
          <button className="rounded-pill bg-charcoal px-4 py-2 text-white">{t('common.apply')}</button>
        </form>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUSES.map((s) => (
          <Kpi key={s} label={t(`status.${s}`)} value={format.number(dash.status[s])} />
        ))}
        <Kpi
          label={t('analytics.subscribers.netGrowth')}
          value={format.number(dash.net.growth, { signDisplay: 'exceptZero' })}
          sub={`${t('analytics.subscribers.created')}: ${format.number(dash.net.created)} · ${t('analytics.subscribers.left')}: ${format.number(dash.net.unsubscribed)}`}
        />
      </div>

      <Panel title={t('analytics.subscribers.growthOverTime')}>
        <LineChart
          title={t('analytics.subscribers.growthOverTime')}
          periods={dash.periods}
          emptyLabel={t('common.noData')}
          series={dash.growth.map((g) => ({
            label: statusLabel(g.status),
            color: STATUS_COLOR[g.status] ?? 'var(--color-stone)',
            values: g.points.map((p) => p.value),
            formatted: g.points.map((p) => format.number(p.value)),
          }))}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t('analytics.subscribers.byLocale')}>
          <BarList
            emptyLabel={t('common.noData')}
            items={dash.byLocale.map((l) => ({ key: l.locale, label: t(`locales.${l.locale}`), value: l.count, display: format.number(l.count) }))}
          />
        </Panel>
        <Panel title={t('analytics.subscribers.bySource')}>
          <BarList
            emptyLabel={t('common.noData')}
            items={dash.bySource.map((s) => ({
              key: s.source,
              label: sourceLabel(s.source),
              value: s.total,
              display: format.number(s.total),
              hint: `${t('analytics.subscribers.confirmationRate')}: ${pct(s.confirmationRate)}`,
            }))}
          />
        </Panel>
      </div>

      <Panel title={t('analytics.subscribers.table')}>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="from" value={resolved.from} />
          <input type="hidden" name="to" value={resolved.to} />
          <FilterSelect
            name="status"
            label={t('analytics.subscribers.filterStatus')}
            value={query.status}
            options={[any, ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))]}
          />
          <FilterSelect
            name="locale"
            label={t('analytics.subscribers.filterLocale')}
            value={query.locale}
            options={[any, ...LOCALES.map((l) => ({ value: l, label: t(`locales.${l}`) }))]}
          />
          <FilterSelect
            name="source"
            label={t('analytics.subscribers.filterSource')}
            value={query.source}
            options={[any, ...SOURCES.map((s) => ({ value: s, label: t(`analytics.sources.${s}`) }))]}
          />
          <button className="rounded-pill border border-charcoal px-4 py-2">{t('common.apply')}</button>
          <span className="ms-auto flex flex-wrap gap-3">
            <a className="underline" href={`/api/admin/exports/subscribers${withParams(base, { bucket: null })}`}>
              {t('common.exportCsv')}
            </a>
            <a className="text-danger underline" href={`/api/admin/exports/subscribers${withParams(base, { bucket: null, unmasked: '1' })}`}>
              {t('common.exportUnmasked')}
            </a>
          </span>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-ui">
            <thead className="border-b border-hairline text-eyebrow uppercase tracking-wide text-muted">
              <tr>
                {(['colDate', 'colEmail', 'colStatus', 'colLocale', 'colSource', 'colConfirmed'] as const).map((c) => (
                  <th key={c} className="px-2 py-2 text-start font-medium">
                    {t(`analytics.subscribers.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-stone">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                table.rows.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-b-0">
                    <td className="px-2 py-2 whitespace-nowrap">{format.dateTime(s.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-2 py-2 font-mono text-[0.8125rem]">{s.email ?? t('common.none')}</td>
                    <td className="px-2 py-2">{t(`status.${s.status}`)}</td>
                    <td className="px-2 py-2 uppercase">{s.locale}</td>
                    <td className="px-2 py-2">{t(`analytics.sources.${s.source}`)}</td>
                    <td className="px-2 py-2">{s.confirmedAt ? format.dateTime(s.confirmedAt, { dateStyle: 'short' }) : t('common.none')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <nav className="mt-3 flex gap-4">
          {query.cursor ? (
            <Link className="underline" href={`/admin/analytics/subscribers${withParams(base, { cursor: null })}`}>
              {t('common.firstPage')}
            </Link>
          ) : null}
          {table.nextCursor ? (
            <Link className="underline" href={`/admin/analytics/subscribers${withParams(base, { cursor: table.nextCursor })}`}>
              {t('common.nextPage')}
            </Link>
          ) : null}
        </nav>
      </Panel>
    </div>
  );
}
