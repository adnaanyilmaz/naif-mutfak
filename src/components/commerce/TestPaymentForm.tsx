'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/validators/content';

const METHODS = ['card', 'paypal', 'applePay', 'googlePay'] as const;
type Method = (typeof METHODS)[number];

/** Local test checkout: method choice is illustrative only — no payment details are collected. */
export function TestPaymentForm({ orderRef, locale, productSlug }: { orderRef: string; locale: Locale; productSlug: string }) {
  const t = useTranslations('Checkout');
  const router = useRouter();
  const [method, setMethod] = useState<Method>('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderRef, locale }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) {
        router.push('/checkout/success');
        return;
      }
      const code = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : String(res.status);
      setError(code);
    } catch {
      setError('network');
    }
    setBusy(false);
  }

  return (
    <div>
      <fieldset>
        <legend className="font-display text-[1.0625rem] font-bold">{t('test.methodTitle')}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {METHODS.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                method === m ? 'border-terracotta bg-terracotta-tint/60' : 'border-hairline bg-white hover:border-charcoal'
              }`}
            >
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="size-4 accent-terracotta" />
              <span className="font-semibold">{t(`methods.${m}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-terracotta px-6 font-semibold text-white hover:bg-terracotta-deep disabled:opacity-60"
        >
          {busy ? t('test.paying') : t('test.pay')}
        </button>
        <Link href={`/ebooks/${productSlug}`} className="inline-flex min-h-12 items-center rounded-pill border border-hairline bg-white px-6 font-semibold hover:border-charcoal">
          {t('test.cancel')}
        </Link>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[0.875rem] text-danger">
          {t('test.error', { error })}
        </p>
      ) : null}
    </div>
  );
}
