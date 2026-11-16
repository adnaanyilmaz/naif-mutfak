import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { FilterDate, FilterSelect, Kpi, Panel, touchLink, withParams } from '@/components/admin/AnalyticsParts';
import { BarList } from '@/components/admin/charts/BarList';
import { LineChart } from '@/components/admin/charts/LineChart';
import { RevealEmail } from '@/components/admin/RevealEmail';
import { ADMIN_LOCALE } from '@/i18n/config';
import { getSalesDashboard, listOrders, orderFilters, resolveRange } from '@/services/admin/analytics.service';
import { listProductOptions } from '@/services/admin/products-admin.service';
import { adminProductsDeps, analyticsDeps } from '@/services/container';
import { salesQuerySchema } from '@/validators/admin/analytics';
import { CURRENCIES } from '@/validators/content';
import { requireAdmin } from '../../_server/require-admin';
import { revealOrderEmailAction } from '../actions';

const CURRENCY_COLOR = { TRY: 'var(--color-terracotta)', USD: 'var(--color-olive)', SAR: 'var(--color-charcoal)' } as const;

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' });
  const format = await getFormatter({ locale: ADMIN_LOCALE });
  const parsed = salesQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : {};
  const deps = analyticsDeps();
  const resolved = resolveRange(query, deps.now());
  if (typeof resolved === 'string') {
    return (
      <div className="mx-auto max-w-page">
        <h1 className="font-display text-h2">{t('analytics.sales.title')}</h1>
        <p role="alert" className="mt-6 text-danger">
          {t(`analytics.${resolved}`)}
        </p>
        <Link href="/admin/analytics/sales" className="mt-4 inline-block underline">
          {t('common.firstPage')}
        </Link>
      </div>
    );
  }

  const filters = orderFilters(query, resolved.range);
  const [dash, orders, products] = await Promise.all([
    getSalesDashboard(deps, resolved),
    listOrders(deps, filters, query.cursor),
    listProductOptions(adminProductsDeps()),
  ]);
  const money = (minor: number, currency: string) => format.number(minor / 100, { style: 'currency', currency });
  const pct = (v: number | null) => (v === null ? t('common.none') : format.number(v, { style: 'percent', maximumFractionDigits: 1 }));
  const base: Record<string, string | undefined> = {
    from: resolved.from,
    to: resolved.to,
    bucket: query.bucket,
    status: query.status,
    provider: query.provider,
    currency: query.currency,
    product: query.product,
  };
  const any = { value: '', label: t('analytics.any') };

  return (
    <div className="mx-auto max-w-page space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-h2">{t('analytics.sales.title')}</h1>
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

      <div className="grid gap-3 sm:grid-cols-3">
        {dash.kpis.map((k) => (
          <Kpi
            key={k.currency}
            label={`${t('analytics.sales.gross')} · ${k.currency}`}
            value={money(k.gross, k.currency)}
            sub={`${t('analytics.sales.orders')}: ${format.number(k.orders)} · ${t('analytics.sales.refunds')}: ${format.number(k.refunds)} (${money(k.refundAmount, k.currency)}) · ${t('analytics.sales.refundRate')}: ${pct(k.refundRate)}`}
          />
        ))}
      </div>

      <Panel title={t('analytics.sales.revenueOverTime')}>
        <LineChart
          title={t('analytics.sales.revenueOverTime')}
          periods={dash.periods}
          emptyLabel={t('common.noData')}
          series={dash.revenue.map((s) => ({
            label: s.currency,
            color: CURRENCY_COLOR[s.currency],
            values: s.points.map((p) => p.value / 100),
            formatted: s.points.map((p) => money(p.value, s.currency)),
          }))}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t('analytics.sales.byEdition')}>
          <BarList
            emptyLabel={t('common.noData')}
            items={dash.byEdition.map((e) => ({
              key: `${e.slug}:${e.contentLocale}:${e.currency ?? ''}`,
              label: `${e.slug} · ${e.contentLocale.toUpperCase()}`,
              value: e.orders,
              display: format.number(e.orders),
              hint: e.currency ? money(e.gross, e.currency) : '',
            }))}
          />
        </Panel>
        <Panel title={t('analytics.sales.byBuyerLocale')}>
          <BarList
            emptyLabel={t('common.noData')}
            items={dash.byBuyerLocale.map((l) => ({ key: l.locale, label: t(`locales.${l.locale}`), value: l.orders, display: format.number(l.orders) }))}
          />
        </Panel>
        <Panel title={t('analytics.sales.conversion')} hint={t('analytics.sales.conversionHint')}>
          <p className="font-display text-h2 tabular-nums">{pct(dash.conversion.rate)}</p>
          <p className="mt-2 text-stone">
            {t('status.paid')}: {format.number(dash.conversion.paid)} · {t('status.pending')}: {format.number(dash.conversion.stalePending)} ·{' '}
            {t('status.failed')}: {format.number(dash.conversion.failed)}
          </p>
        </Panel>
      </div>

      <Panel title={t('analytics.sales.ordersTable')}>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="from" value={resolved.from} />
          <input type="hidden" name="to" value={resolved.to} />
          <FilterSelect
            name="status"
            label={t('analytics.sales.filterStatus')}
            value={query.status}
            options={[any, ...(['paid', 'pending', 'refunded', 'failed'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]}
          />
          <FilterSelect
            name="provider"
            label={t('analytics.sales.filterProvider')}
            value={query.provider}
            options={[any, ...(['lemonsqueezy', 'paddle'] as const).map((p) => ({ value: p, label: t(`analytics.providers.${p}`) }))]}
          />
          <FilterSelect
            name="currency"
            label={t('analytics.sales.filterCurrency')}
            value={query.currency}
            options={[any, ...CURRENCIES.map((c) => ({ value: c, label: c }))]}
          />
          <FilterSelect
            name="product"
            label={t('analytics.sales.filterProduct')}
            value={query.product}
            options={[any, ...products.map((p) => ({ value: p.id, label: p.slug }))]}
          />
          <button className="min-h-10 rounded-pill border border-charcoal px-4 py-2">{t('common.apply')}</button>
          <span className="flex w-full flex-wrap gap-x-4 sm:ms-auto sm:w-auto">
            <a className={touchLink} href={`/api/admin/exports/orders${withParams(base, { bucket: null })}`}>
              {t('common.exportCsv')}
            </a>
            <a className={`${touchLink} text-danger`} href={`/api/admin/exports/orders${withParams(base, { bucket: null, unmasked: '1' })}`}>
              {t('common.exportUnmasked')}
            </a>
          </span>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-ui">
            <thead className="border-b border-hairline text-eyebrow uppercase tracking-wide text-muted">
              <tr>
                {(['colDate', 'colProduct', 'colEdition', 'colBuyerLocale', 'colAmount', 'colStatus', 'colProvider', 'colEmail'] as const).map((c) => (
                  <th key={c} className="px-2 py-2 text-start font-medium">
                    {t(`analytics.sales.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-stone">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                orders.rows.map((o) => (
                  <tr key={o.id} className="border-b border-hairline last:border-b-0">
                    <td className="px-2 py-2 whitespace-nowrap">{format.dateTime(o.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-2 py-2">{o.productSlug}</td>
                    <td className="px-2 py-2 uppercase">{o.contentLocale}</td>
                    <td className="px-2 py-2 uppercase">{o.customerLocale}</td>
                    <td className="px-2 py-2 tabular-nums">{o.currency && o.amountTotal !== null ? money(o.amountTotal, o.currency) : t('common.none')}</td>
                    <td className="px-2 py-2">{t(`status.${o.status}`)}</td>
                    <td className="px-2 py-2">{t(`analytics.providers.${o.provider}`)}</td>
                    <td className="px-2 py-2">
                      <RevealEmail orderId={o.id} masked={o.email} revealAction={revealOrderEmailAction} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <nav className="mt-3 flex gap-4">
          {query.cursor ? (
            <Link className={touchLink} href={`/admin/analytics/sales${withParams(base, { cursor: null })}`}>
              {t('common.firstPage')}
            </Link>
          ) : null}
          {orders.nextCursor ? (
            <Link className={touchLink} href={`/admin/analytics/sales${withParams(base, { cursor: orders.nextCursor })}`}>
              {t('common.nextPage')}
            </Link>
          ) : null}
        </nav>
      </Panel>

      <Panel title={t('analytics.sales.webhookHealth')}>
        <div className="flex flex-wrap gap-3">
          {dash.webhooks.outcomes.length === 0 ? (
            <p className="text-stone">{t('common.noData')}</p>
          ) : (
            dash.webhooks.outcomes.map((o) => (
              <Kpi key={o.outcome} label={t(`status.${o.outcome === 'processed' || o.outcome === 'ignored' || o.outcome === 'failed' ? o.outcome : 'failed'}`)} value={format.number(o.count)} />
            ))
          )}
        </div>
        {dash.webhooks.failed.length > 0 ? (
          <>
            <h3 className="mt-5 font-medium">{t('analytics.sales.failedEvents')}</h3>
            <ul className="mt-2 divide-y divide-hairline">
              {dash.webhooks.failed.map((f) => (
                <li key={f.id} className="flex flex-wrap gap-x-4 py-2">
                  <span className="text-stone">{format.dateTime(f.receivedAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span>{t(`analytics.providers.${f.provider === 'paddle' ? 'paddle' : 'lemonsqueezy'}`)}</span>
                  <span className="font-mono text-[0.8125rem]">{f.eventName}</span>
                  <span className="text-danger">{f.error ?? t('common.none')}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Panel>
    </div>
  );
}
