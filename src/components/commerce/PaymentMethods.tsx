import { getTranslations } from 'next-intl/server';

const METHODS = ['card', 'paypal', 'applePay', 'googlePay'] as const;

function LockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** "Secure checkout" note + accepted methods (shown by the MoR overlay; no card data ever reaches us). */
export async function PaymentMethods({ tone = 'default' }: { tone?: 'default' | 'inverted' }) {
  const t = await getTranslations('Checkout');
  const muted = tone === 'inverted' ? 'text-white/60' : 'text-muted';
  const chip = tone === 'inverted' ? 'border-white/15 text-white/80' : 'border-hairline bg-white text-stone';
  return (
    <div className="space-y-2">
      <p className={`flex items-center gap-1.5 text-[0.8125rem] font-semibold ${tone === 'inverted' ? 'text-white/80' : 'text-olive'}`}>
        <LockIcon />
        {t('secure')}
      </p>
      <ul aria-label={t('methodsLabel')} className="flex flex-wrap gap-1.5">
        {METHODS.map((m) => (
          <li key={m} className={`rounded-md border px-2 py-0.5 text-[0.75rem] font-semibold ${chip}`}>
            {t(`methods.${m}`)}
          </li>
        ))}
      </ul>
      <p className={`max-w-md text-[0.75rem] ${muted}`}>{t('morNote')}</p>
    </div>
  );
}
