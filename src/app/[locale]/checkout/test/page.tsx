// Local development only (404 elsewhere): stands in for the MoR overlay when no API keys are configured.
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PaymentMethods } from '@/components/commerce/PaymentMethods';
import { TestPaymentForm } from '@/components/commerce/TestPaymentForm';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { testCheckoutDeps } from '@/services/container';
import { ORDER_COOKIE_NAME } from '@/services/payments/delivery.service';
import { getTestCheckout } from '@/services/payments/test-checkout.service';
import { testCheckoutInputSchema } from '@/validators/api';

export const dynamic = 'force-dynamic';

interface TestCheckoutPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TestCheckoutPage({ params, searchParams }: TestCheckoutPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const deps = testCheckoutDeps();
  if (!deps) notFound();

  const t = await getTranslations({ locale, namespace: 'Checkout' });
  const input = testCheckoutInputSchema.safeParse({ orderRef: (await searchParams).ref, locale });
  const cookie = (await cookies()).get(ORDER_COOKIE_NAME)?.value;
  const view = input.success ? await getTestCheckout(deps, cookie, input.data.orderRef, locale) : null;

  return (
    <div className="mx-auto max-w-wide px-4 pt-10 pb-20 sm:px-6 md:pt-16">
      <p className="inline-flex items-center gap-2 rounded-pill bg-butter/60 px-3 py-1.5 text-[0.8125rem] font-bold">{t('test.badge')}</p>
      {view ? (
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_20rem]">
          <div>
            <h1 className="font-display text-h2 font-extrabold">{t('test.title')}</h1>
            <p className="mt-3 max-w-xl rounded-2xl border border-[#f3d48a] bg-[#fff8e6] p-4 text-[0.9375rem] text-stone">{t('test.notice')}</p>
            <div className="mt-8">
              <TestPaymentForm orderRef={view.orderRef} locale={locale} productSlug={view.productSlug} />
            </div>
          </div>
          <aside className="h-fit space-y-5 rounded-[1.5rem] border border-hairline bg-white p-5 shadow-card">
            <div>
              <h2 className="font-display text-[1.0625rem] font-bold">{t('summary')}</h2>
              <dl className="mt-4 space-y-3 text-[0.9375rem]">
                <div>
                  <dt className="text-[0.75rem] text-muted">{t('product')}</dt>
                  <dd className="font-semibold">{view.productTitle}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t('edition')}</dt>
                  <dd className="font-semibold uppercase">{view.edition}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-hairline pt-3">
                  <dt className="text-muted">{t('total')}</dt>
                  <dd className="font-display text-[1.25rem] font-extrabold tabular-nums">{view.price}</dd>
                </div>
              </dl>
            </div>
            <PaymentMethods />
          </aside>
        </div>
      ) : (
        <div className="mt-6">
          <h1 className="font-display text-h2 font-extrabold">{t('test.notFoundTitle')}</h1>
          <p className="mt-3 max-w-xl text-stone">{t('test.notFoundBody')}</p>
          <Link href="/ebooks" className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-charcoal px-6 font-semibold text-white hover:bg-terracotta">
            {t('browse')}
          </Link>
        </div>
      )}
    </div>
  );
}
