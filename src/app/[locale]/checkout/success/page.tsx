import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CheckoutStatus } from '@/components/commerce/CheckoutStatus';
import { routing } from '@/i18n/routing';
import { orderStatusDeps } from '@/services/container';
import { ORDER_COOKIE_NAME } from '@/services/payments/delivery.service';
import { getOrderStatus } from '@/services/payments/order-status.service';

export const dynamic = 'force-dynamic';

interface SuccessPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: SuccessPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Checkout' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function CheckoutSuccessPage({ params }: SuccessPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const cookie = (await cookies()).get(ORDER_COOKIE_NAME)?.value;
  // First status is rendered on the server (no flash); the client keeps polling while pending.
  const initial = await getOrderStatus(orderStatusDeps(), cookie, locale);

  return (
    <div className="mx-auto max-w-wide px-4 pt-10 pb-20 sm:px-6 md:pt-16">
      <CheckoutStatus locale={locale} initial={initial} />
    </div>
  );
}
