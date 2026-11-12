import Link from 'next/link';
import type { ReactNode } from 'react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AdminCard, AdminPageHeader, StatusBadge, primaryButton, secondaryButton } from '@/components/admin/AdminPage';
import { AlertIcon, BookIcon, ChartIcon, PlusIcon, PostsIcon, UsersIcon } from '@/components/admin/icons';
import { ADMIN_LOCALE } from '@/i18n/config';
import { getAdminOverview } from '@/services/admin/overview.service';
import { overviewDeps } from '@/services/container';
import { requireAdmin } from './_server/require-admin';
import { createPostAction } from './posts/actions';
import { createProductAction } from './products/actions';

function Stat({ href, icon, label, value, lines }: { href: string; icon: ReactNode; label: string; value: string; lines: string[] }) {
  return (
    <Link href={href} className="group rounded-2xl border border-hairline bg-white p-5 transition-shadow hover:shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[0.8125rem] font-semibold text-muted">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-xl bg-terracotta-tint text-terracotta">{icon}</span>
      </div>
      <p className="mt-3 font-display text-[2rem] leading-none font-extrabold tabular-nums">{value}</p>
      <ul className="mt-3 space-y-0.5 text-[0.8125rem] text-stone">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [o, t, format] = await Promise.all([
    getAdminOverview(overviewDeps()),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' }),
    getFormatter({ locale: ADMIN_LOCALE }),
  ]);
  const money = (minor: number, currency: string) => format.number(minor / 100, { style: 'currency', currency });
  const firstSale = o.sales[0];

  return (
    <div className="mx-auto max-w-wide space-y-8">
      <AdminPageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <>
            <form action={createProductAction}>
              <button className={secondaryButton}>
                <PlusIcon className="size-4" />
                {t('products.new')}
              </button>
            </form>
            <form action={createPostAction}>
              <button className={primaryButton}>
                <PlusIcon className="size-4" />
                {t('posts.new')}
              </button>
            </form>
          </>
        }
      />

      {o.failedWebhooks > 0 ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f5c2bd] bg-[#fdecea] px-4 py-3 text-danger">
          <AlertIcon className="size-5" />
          <span className="flex-1">{t('overview.webhookAlert', { n: o.failedWebhooks })}</span>
          <Link href="/admin/analytics/sales" className="font-semibold underline underline-offset-4">
            {t('overview.review')}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          href="/admin/posts"
          icon={<PostsIcon className="size-5" />}
          label={t('overview.posts')}
          value={format.number(o.posts.total)}
          lines={[t('overview.published', { n: o.posts.published }), t('overview.drafts', { n: o.posts.drafts })]}
        />
        <Stat
          href="/admin/products"
          icon={<BookIcon className="size-5" />}
          label={t('overview.ebooks')}
          value={format.number(o.ebooks.total)}
          lines={[
            t('overview.activeEditions', { n: o.ebooks.activeEditions }),
            ...(o.ebooks.missingPdfs > 0 ? [`${t('products.pdfMissingHint')}: ${format.number(o.ebooks.missingPdfs)}`] : []),
          ]}
        />
        <Stat
          href="/admin/analytics/sales"
          icon={<ChartIcon className="size-5" />}
          label={t('overview.sales30')}
          value={firstSale ? money(firstSale.gross, firstSale.currency) : '—'}
          lines={
            o.sales.length === 0
              ? [t('overview.noSales')]
              : o.sales.map((s, i) => (i === 0 ? t('overview.orders', { n: s.orders }) : `${money(s.gross, s.currency)} · ${t('overview.orders', { n: s.orders })}`))
          }
        />
        <Stat
          href="/admin/analytics/subscribers"
          icon={<UsersIcon className="size-5" />}
          label={t('overview.subscribers')}
          value={format.number(o.subscribers.active + o.subscribers.pending)}
          lines={[t('overview.activeSubs', { n: o.subscribers.active }), t('overview.pendingSubs', { n: o.subscribers.pending })]}
        />
      </div>

      <AdminCard title={t('overview.recentPosts')}>
        <ul className="-my-2 divide-y divide-hairline">
          {o.posts.recent.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/posts/${p.id}`} className="flex items-center gap-4 rounded-xl py-3 hover:bg-linen/60">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                  <img src={p.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span aria-hidden className="size-12 shrink-0 rounded-xl bg-gradient-to-br from-terracotta-tint to-[#ffd59a]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.title || t('posts.untitled')}</span>
                  <span className="text-[0.8125rem] text-muted">{format.dateTime(p.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </span>
                <StatusBadge status={p.status} label={t(`status.${p.status}`)} />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/admin/posts" className="mt-4 inline-block text-[0.875rem] font-semibold text-terracotta hover:text-terracotta-deep">
          {t('overview.allPosts')} →
        </Link>
      </AdminCard>
    </div>
  );
}
