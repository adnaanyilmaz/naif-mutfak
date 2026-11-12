import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AdminPageHeader, EmptyState, StatusBadge, primaryButton } from '@/components/admin/AdminPage';
import { AlertIcon, PlusIcon } from '@/components/admin/icons';
import { ADMIN_LOCALE } from '@/i18n/config';
import { listAdminProducts } from '@/services/admin/products-admin.service';
import { adminProductsDeps } from '@/services/container';
import { requireAdmin } from '../_server/require-admin';
import { createProductAction } from './actions';

export default async function AdminProductsPage() {
  await requireAdmin();
  const [products, t, format] = await Promise.all([
    listAdminProducts(adminProductsDeps()),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' }),
    getFormatter({ locale: ADMIN_LOCALE }),
  ]);
  const newButton = (
    <form action={createProductAction}>
      <button className={primaryButton}>
        <PlusIcon className="size-4" />
        {t('products.new')}
      </button>
    </form>
  );

  return (
    <div className="mx-auto max-w-wide space-y-6">
      <AdminPageHeader title={t('products.title')} subtitle={t('products.subtitle')} actions={newButton} />
      {products.length === 0 ? (
        <EmptyState title={t('products.emptyTitle')} body={t('products.emptyBody')} action={newButton} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const missingPdf = p.variants.some((v) => !v.hasPdf);
            return (
              <li key={p.id} className="group relative flex gap-4 rounded-2xl border border-hairline bg-white p-4 transition-shadow hover:shadow-card">
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                  <img src={p.coverUrl} alt="" className="aspect-[3/4] w-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span aria-hidden className="aspect-[3/4] w-20 shrink-0 rounded-xl bg-gradient-to-br from-brand via-[#d96d04] to-[#8a3b06]" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/products/${p.id}`} className="font-semibold leading-snug after:absolute after:inset-0 group-hover:text-terracotta">
                      {p.title}
                    </Link>
                    <StatusBadge status={p.status} label={t(`status.${p.status}`)} />
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[0.75rem] text-muted">{p.slug}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                    {p.variants.map((v) => (
                      <span
                        key={v.contentLocale}
                        title={`${t(v.isActive ? 'status.active' : 'status.draft')}${v.hasPdf ? '' : ` · ${t('products.pdfMissingHint')}`}`}
                        className={`rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase ${v.isActive ? 'bg-olive-tint text-olive' : 'bg-linen text-muted'}`}
                      >
                        {v.contentLocale}
                      </span>
                    ))}
                    {missingPdf ? (
                      <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[#8a5a00]">
                        <AlertIcon className="size-3.5" />
                        {t('products.pdfMissingHint')}
                      </span>
                    ) : null}
                    {p.fromPriceTry !== null ? (
                      <span className="ms-auto text-[0.875rem] font-bold tabular-nums">
                        {format.number(p.fromPriceTry / 100, { style: 'currency', currency: 'TRY' })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
