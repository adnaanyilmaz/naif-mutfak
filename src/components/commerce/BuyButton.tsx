'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { checkoutResponseSchema } from '@/validators/checkout-response';
import { openCheckoutOverlay } from './open-overlay';

interface BuyButtonProps {
  variantId: string;
  productTitle: string;
  placement: 'callout' | 'storefront';
  size?: 'md' | 'sm';
  /** `light` for dark backgrounds. */
  tone?: 'accent' | 'light';
}

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: 'error' | 'unavailable' };

export function BuyButton({ variantId, productTitle, placement, size = 'md', tone = 'accent' }: BuyButtonProps) {
  const t = useTranslations('Ebooks');
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onClick() {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, locale }),
      });
      const body = checkoutResponseSchema.safeParse(await res.json().catch(() => null));
      if (!body.success || !body.data.ok) {
        const unavailable = body.success && !body.data.ok && body.data.error === 'provider_not_configured';
        setState({ kind: 'error', message: unavailable ? 'unavailable' : 'error' });
        return;
      }
      await openCheckoutOverlay(body.data.checkout);
      setState({ kind: 'idle' });
    } catch {
      setState({ kind: 'error', message: 'error' });
    }
  }

  const loading = state.kind === 'loading';
  const height = size === 'sm' ? 'min-h-10 px-4' : 'min-h-12 px-6';
  const colors =
    tone === 'light'
      ? 'bg-white text-charcoal hover:bg-terracotta-tint'
      : 'bg-terracotta text-white shadow-[0_8px_20px_-8px_rgb(180_83_9/0.6)] hover:bg-terracotta-deep';

  return (
    <div className="flex flex-col items-start gap-2" data-placement={placement}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-label={t('buyFor', { title: productTitle })}
        aria-busy={loading}
        className={`${height} ${colors} inline-flex items-center gap-2 rounded-pill text-ui font-semibold transition-colors duration-200 ease-editorial disabled:cursor-progress disabled:opacity-80`}
      >
        {loading && (
          <span aria-hidden className="size-4 animate-spin rounded-pill border-2 border-current border-t-transparent" />
        )}
        {loading ? t('loading') : t('buy')}
        {!loading && (
          <span aria-hidden className="inline-block rtl:-scale-x-100">
            →
          </span>
        )}
      </button>
      <p role="status" aria-live="polite" className={`text-[0.8125rem] empty:hidden ${tone === 'light' ? 'text-[#fca5a5]' : 'text-danger'}`}>
        {state.kind === 'error' ? t(state.message) : ''}
      </p>
    </div>
  );
}
