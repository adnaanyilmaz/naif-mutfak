import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AdminPageHeader, EmptyState, StatusBadge, primaryButton } from '@/components/admin/AdminPage';
import { ExternalIcon, PlusIcon, SearchIcon } from '@/components/admin/icons';
import { ADMIN_LOCALE } from '@/i18n/config';
import { filterAdminPosts, listAdminPosts } from '@/services/admin/posts-admin.service';
import { categoryKey } from '@/services/content/category';
import { adminPostsDeps } from '@/services/container';
import { POST_STATUSES, postListQuerySchema } from '@/validators/admin/post';
import { requireAdmin } from '../_server/require-admin';
import { createPostAction } from './actions';

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const parsed = postListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : {};
  const [all, t, format] = await Promise.all([
    listAdminPosts(adminPostsDeps()),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' }),
    getFormatter({ locale: ADMIN_LOCALE }),
  ]);
  const posts = filterAdminPosts(all, query);
  const tabHref = (status: string | null) => {
    const p = new URLSearchParams();
    if (query.q) p.set('q', query.q);
    if (status) p.set('status', status);
    const s = p.toString();
    return `/admin/posts${s ? `?${s}` : ''}`;
  };
  const countOf = (status: string | null) => (status ? all.filter((p) => p.status === status).length : all.length);
  const newButton = (
    <form action={createPostAction}>
      <button className={primaryButton}>
        <PlusIcon className="size-4" />
        {t('posts.new')}
      </button>
    </form>
  );

  return (
    <div className="mx-auto max-w-wide space-y-6">
      <AdminPageHeader title={t('posts.title')} subtitle={t('posts.subtitle')} actions={newButton} />

      {all.length === 0 ? (
        <EmptyState title={t('posts.emptyTitle')} body={t('posts.emptyBody')} action={newButton} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-white">
          <div className="flex flex-col gap-3 border-b border-hairline p-4 md:flex-row md:items-center md:justify-between">
            <nav aria-label={t('posts.filterLabel')} className="scrollbar-none flex gap-1 overflow-x-auto rounded-pill bg-linen p-1">
              {[null, ...POST_STATUSES].map((s) => {
                const active = (query.status ?? null) === s;
                return (
                  <Link
                    key={s ?? 'all'}
                    href={tabHref(s)}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[0.8125rem] md:min-h-0 font-semibold whitespace-nowrap ${
                      active ? 'bg-white text-charcoal shadow-[0_1px_3px_rgb(0_0_0/0.1)]' : 'text-stone hover:text-charcoal'
                    }`}
                  >
                    {s ? t(`status.${s}`) : t('posts.all')}
                    <span className="text-muted tabular-nums">{format.number(countOf(s))}</span>
                  </Link>
                );
              })}
            </nav>
            <form method="get" role="search" className="relative md:w-72">
              {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={query.q ?? ''}
                placeholder={t('posts.search')}
                aria-label={t('posts.searchLabel')}
                className="h-10 w-full rounded-pill border border-hairline bg-white ps-9 pe-4 text-[0.9375rem] outline-none focus:border-charcoal"
              />
            </form>
          </div>

          {posts.length === 0 ? (
            <p className="px-6 py-12 text-center text-stone">{t('posts.noResults')}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {posts.map((p) => {
                const cat = categoryKey(p.category);
                return (
                  <li key={p.id} className="group relative flex items-center gap-4 px-4 py-3 hover:bg-linen/50 md:px-5">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                      <img src={p.thumbnailUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden className="size-14 shrink-0 rounded-xl bg-gradient-to-br from-terracotta-tint to-[#ffd59a]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/posts/${p.id}`} className="font-semibold after:absolute after:inset-0 group-hover:text-terracotta">
                        {p.title || t('posts.untitled')}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                        <span>{cat === 'other' ? p.category : t(`categories.${cat}`)}</span>
                        <span aria-hidden>·</span>
                        <span>{format.dateTime(p.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </p>
                    </div>
                    <span className="hidden gap-1 sm:flex" title={t('posts.localeLegend')}>
                      {p.locales.map((l) => (
                        <span
                          key={l.locale}
                          className={`rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase ${l.isPublished ? 'bg-olive-tint text-olive' : 'bg-linen text-muted'}`}
                        >
                          {l.locale}
                        </span>
                      ))}
                    </span>
                    <StatusBadge status={p.status} label={t(`status.${p.status}`)} />
                    {p.publicPath ? (
                      <Link
                        href={p.publicPath}
                        target="_blank"
                        rel="noopener"
                        aria-label={t('posts.viewOnSite')}
                        title={t('posts.viewOnSite')}
                        className="relative z-10 hidden size-9 items-center justify-center rounded-full text-muted hover:bg-white hover:text-charcoal md:flex"
                      >
                        <ExternalIcon className="size-4" />
                      </Link>
                    ) : (
                      <span aria-hidden className="hidden size-9 md:block" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
