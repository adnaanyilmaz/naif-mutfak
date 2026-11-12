import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminNav } from '@/components/admin/AdminNav';
import { ADMIN_LOCALE, LOCALE_META } from '@/i18n/config';
import { fontVariables } from '../fonts';
import { getAdminOrFailure } from './_server/require-admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin.meta' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminOrFailure();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' });
  const messages = await getMessages({ locale: ADMIN_LOCALE });

  return (
    <html lang={ADMIN_LOCALE} dir={LOCALE_META[ADMIN_LOCALE].dir} data-script="latin" className={fontVariables}>
      <body className="min-h-dvh bg-linen font-sans text-ui text-charcoal">
        {typeof admin === 'string' ? (
          <main className="mx-auto max-w-content px-6 py-24 text-center">
            <h1 className="font-display text-h2">{t(admin === 'forbidden' ? 'auth.forbiddenTitle' : 'auth.unauthorizedTitle')}</h1>
            <p className="mt-4 text-stone">{t(admin === 'forbidden' ? 'auth.forbiddenBody' : 'auth.unauthorizedBody')}</p>
          </main>
        ) : (
          <NextIntlClientProvider locale={ADMIN_LOCALE} messages={messages}>
            <div className="flex min-h-dvh flex-col md:flex-row">
              <AdminNav email={admin.email} devMode={admin.via === 'dev'} />
              <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
            </div>
          </NextIntlClientProvider>
        )}
      </body>
    </html>
  );
}
