import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ADMIN_LOCALE } from '@/i18n/config';

const LINKS = [
  { href: '/admin/posts', key: 'posts' },
  { href: '/admin/products', key: 'products' },
  { href: '/admin/analytics/sales', key: 'sales' },
  { href: '/admin/analytics/subscribers', key: 'subscribers' },
] as const;

export async function AdminNav({ email, devMode }: { email: string; devMode: boolean }) {
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin.nav' });
  return (
    <aside className="border-b border-hairline bg-paper md:w-60 md:shrink-0 md:border-b-0 md:border-e">
      <div className="px-5 py-5">
        <p className="font-display text-h3">Naif Mutfak</p>
        <p className="mt-1 break-all text-eyebrow text-muted">{t('signedInAs', { email })}</p>
        {devMode ? <p className="mt-2 inline-block rounded-pill bg-butter px-2 py-0.5 text-eyebrow">{t('devMode')}</p> : null}
      </div>
      <nav aria-label={t('label')} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-card px-3 py-2 hover:bg-linen focus-visible:bg-linen">
            {t(l.key)}
          </Link>
        ))}
        <Link href="/tr" className="whitespace-nowrap rounded-card px-3 py-2 text-muted hover:bg-linen md:mt-4">
          {t('viewSite')}
        </Link>
      </nav>
    </aside>
  );
}
