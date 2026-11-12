import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AdminCard, AdminPageHeader, StatusBadge } from '@/components/admin/AdminPage';
import { CopyField } from '@/components/admin/CopyField';
import { AlertIcon, CheckIcon } from '@/components/admin/icons';
import { ADMIN_LOCALE } from '@/i18n/config';
import { getPaymentSettings } from '@/services/admin/payment-settings.service';
import { paymentSettingsDeps } from '@/services/container';
import { requireAdmin } from '../_server/require-admin';

const METHODS = ['card', 'paypal', 'applePay', 'googlePay'] as const;

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const [s, t, c, format] = await Promise.all([
    getPaymentSettings(paymentSettingsDeps()),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' }),
    getTranslations({ locale: ADMIN_LOCALE, namespace: 'Checkout' }),
    getFormatter({ locale: ADMIN_LOCALE }),
  ]);
  const modeLabel = s.mode === 'test' ? t('payments.modeTest') : s.mode === 'sandbox' ? t('payments.modeSandbox') : t('payments.modeLive');
  const outcome = (o: string) => (o === 'processed' || o === 'ignored' || o === 'failed' ? o : 'failed');

  return (
    <div className="mx-auto max-w-wide space-y-6">
      <AdminPageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <AdminCard title={t('payments.provider')} hint={t('payments.switchHint')}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-[1.5rem] font-extrabold">{t(`analytics.providers.${s.provider}`)}</p>
            <StatusBadge status={s.mode === 'live' ? 'active' : 'pending'} label={`${t('payments.mode')}: ${modeLabel}`} />
          </div>
          {s.testCheckout ? (
            <p className="mt-4 rounded-xl border border-[#f3d48a] bg-[#fff8e6] p-3 text-[0.875rem] text-stone">{t('payments.testHint')}</p>
          ) : null}
        </AdminCard>

        <AdminCard title={t('payments.methods')} hint={t('payments.methodsHint')}>
          <ul className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <li key={m} className="rounded-lg border border-hairline bg-white px-2.5 py-1 text-[0.8125rem] font-semibold">
                {c(`methods.${m}`)}
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      <AdminCard title={t('payments.checklist')} hint={t('payments.secretsHint')}>
        <ul className="divide-y divide-hairline">
          {s.checks.map((check) => (
            <li key={check.key} className="flex items-center justify-between gap-4 py-3">
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`flex size-7 items-center justify-center rounded-full ${check.ok ? 'bg-olive-tint text-olive' : 'bg-[#fdecea] text-danger'}`}
                >
                  {check.ok ? <CheckIcon className="size-4" /> : <AlertIcon className="size-4" />}
                </span>
                <span>
                  <span className="block font-semibold">{t(`payments.checks.${check.key}`)}</span>
                  <code className="text-[0.75rem] text-muted" dir="ltr">
                    {check.env}
                  </code>
                </span>
              </span>
              <StatusBadge status={check.ok ? 'active' : 'failed'} label={check.ok ? t('payments.configured') : t('payments.missing')} />
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard title={t('payments.webhookUrl')} hint={t('payments.webhookUrlHint')}>
        <CopyField value={s.webhookUrl} />
        <p className="mt-5 text-[0.8125rem] font-semibold text-muted">{t('payments.events')}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {s.events.map((e) => (
            <li key={e}>
              <code className="rounded-lg bg-linen px-2.5 py-1 font-mono text-[0.8125rem]" dir="ltr">
                {e}
              </code>
            </li>
          ))}
        </ul>
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title={t('payments.editions')}>
          {s.missingIds.length === 0 ? (
            <p className="flex items-center gap-2 text-olive">
              <CheckIcon className="size-5" />
              {t('payments.editionsNone')}
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {s.missingIds.map((m) => (
                <li key={`${m.productId}:${m.locale}`}>
                  <Link href={`/admin/products/${m.productId}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-terracotta">
                    <span className="font-medium">{m.title}</span>
                    <span className="rounded-md bg-linen px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase">{m.locale}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title={t('payments.webhooks7d')}>
          {s.outcomes.length === 0 ? (
            <p className="text-stone">{t('common.noData')}</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {s.outcomes.map((o) => (
                <li key={o.outcome} className="rounded-xl border border-hairline px-4 py-3">
                  <StatusBadge status={outcome(o.outcome)} label={t(`status.${outcome(o.outcome)}`)} />
                  <p className="mt-2 font-display text-[1.5rem] font-extrabold tabular-nums">{format.number(o.count)}</p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
