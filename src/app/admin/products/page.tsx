import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ADMIN_LOCALE } from '@/i18n/config';
import { listAdminProducts } from '@/services/admin/products-admin.service';
import { adminProductsDeps } from '@/services/container';
import { requireAdmin } from '../_server/require-admin';
import { createProductAction } from './actions';

export default async function AdminProductsPage() {
  await requireAdmin();
  const [products, t] = await Promise.all([
    listAdminProducts(adminProductsDeps()),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' }),
  ]);

  return (
    <div className="mx-auto max-w-wide">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h2">{t('products.title')}</h1>
        <form action={createProductAction}>
          <button className="rounded-pill bg-terracotta px-5 py-2 font-medium text-white hover:bg-terracotta-deep">{t('products.new')}</button>
        </form>
      </header>
      {products.length === 0 ? (
        <p className="mt-8 text-stone">{t('products.empty')}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-card border border-hairline bg-paper">
          <table className="w-full min-w-[36rem]">
            <thead className="border-b border-hairline text-eyebrow uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('products.colTitle')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('products.colSlug')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('products.colStatus')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('products.colEditions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const title = p.titles.find((x) => x.locale === 'tr')?.title ?? p.titles[0]?.title ?? p.slug;
                return (
                  <tr key={p.id} className="border-b border-hairline last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                        {title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-stone">{p.slug}</td>
                    <td className="px-4 py-3">{t(`status.${p.status}`)}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {p.variants.map((v) => (
                          <span
                            key={v.contentLocale}
                            className={`rounded-pill px-2 py-0.5 text-eyebrow uppercase ${v.isActive ? 'bg-olive-tint text-olive' : 'bg-linen text-stone'}`}
                            title={`${t(v.isActive ? 'status.active' : 'status.draft')} · ${v.hasPdf ? 'PDF' : t('productEditor.pdfMissing')}`}
                          >
                            {v.contentLocale}
                            {v.hasPdf ? '' : ' !'}
                          </span>
                        ))}
                      </span>
                    </td>
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
