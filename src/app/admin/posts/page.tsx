import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ADMIN_LOCALE } from '@/i18n/config';
import { listAdminPosts } from '@/services/admin/posts-admin.service';
import { categoryKey } from '@/services/content/category';
import { adminPostsDeps } from '@/services/container';
import { requireAdmin } from '../_server/require-admin';
import { createPostAction } from './actions';

export default async function AdminPostsPage() {
  await requireAdmin();
  const [posts, t, format] = await Promise.all([
    listAdminPosts(adminPostsDeps()),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' }),
    getFormatter({ locale: ADMIN_LOCALE }),
  ]);

  return (
    <div className="mx-auto max-w-wide">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h2">{t('posts.title')}</h1>
        <form action={createPostAction}>
          <button className="rounded-pill bg-terracotta px-5 py-2 font-medium text-white hover:bg-terracotta-deep">{t('posts.new')}</button>
        </form>
      </header>

      {posts.length === 0 ? (
        <p className="mt-8 text-stone">{t('posts.empty')}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-card border border-hairline bg-paper">
          <table className="w-full min-w-[40rem] text-start">
            <thead className="border-b border-hairline text-eyebrow uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('posts.colTitle')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('posts.colStatus')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('posts.colLocales')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('posts.colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const cat = categoryKey(p.category);
                return (
                  <tr key={p.id} className="border-b border-hairline last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/posts/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                        {p.title || t('posts.untitled')}
                      </Link>
                      <span className="ms-2 text-eyebrow text-muted">{cat === 'other' ? p.category : t(`categories.${cat}`)}</span>
                    </td>
                    <td className="px-4 py-3">{t(`status.${p.status}`)}</td>
                    <td className="px-4 py-3">
                      <span className="flex gap-1">
                        {p.locales.map((l) => (
                          <span
                            key={l.locale}
                            title={t(l.isPublished ? 'status.published' : 'status.draft')}
                            className={`rounded-pill px-2 py-0.5 text-eyebrow uppercase ${l.isPublished ? 'bg-olive-tint text-olive' : 'bg-linen text-stone'}`}
                          >
                            {l.locale}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone">{format.dateTime(p.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
