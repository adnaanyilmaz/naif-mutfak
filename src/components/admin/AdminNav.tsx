import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/layout/Logo';
import { ADMIN_LOCALE } from '@/i18n/config';
import { AdminNavLinks } from './AdminNavLinks';
import { ExternalIcon } from './icons';

export async function AdminNav({ email, devMode }: { email: string; devMode: boolean }) {
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin.nav' });
  return (
    <aside className="z-30 border-b border-hairline bg-white md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-e">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-6">
          <Link href="/admin" className="rounded-pill">
            <Logo size={36} />
          </Link>
          <Link
            href="/tr"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-hairline px-3 text-[0.8125rem] font-medium text-stone hover:border-charcoal hover:text-charcoal md:hidden"
          >
            {t('viewSite')}
            <ExternalIcon className="size-3.5" />
          </Link>
        </div>
        <AdminNavLinks />
        <div className="mt-auto hidden border-t border-hairline p-4 md:block">
          <Link
            href="/tr"
            target="_blank"
            rel="noopener"
            className="mb-3 flex items-center justify-between rounded-xl px-3 py-2 text-[0.9375rem] font-medium text-stone hover:bg-linen hover:text-charcoal"
          >
            {t('viewSite')}
            <ExternalIcon className="size-4" />
          </Link>
          <div className="flex items-center gap-3 rounded-xl bg-linen px-3 py-2.5">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-charcoal text-[0.8125rem] font-bold text-white uppercase">
              {email.charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.75rem] text-muted">{t('signedIn')}</span>
              <span className="block truncate text-[0.8125rem] font-medium" title={email}>
                {email}
              </span>
            </span>
          </div>
          {devMode ? <p className="mt-2 rounded-pill bg-butter/60 px-3 py-1 text-center text-[0.75rem] font-medium">{t('devMode')}</p> : null}
        </div>
      </div>
    </aside>
  );
}
