'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Read-only value with a copy button (webhook URL, event names). */
export function CopyField({ value }: { value: string }) {
  const t = useTranslations('Admin.payments');
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline bg-linen/60 p-1.5 ps-3">
      <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]" dir="ltr">
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-white px-3 md:min-h-0 md:py-1.5 text-[0.8125rem] font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)] hover:bg-charcoal hover:text-white"
      >
        <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
      </button>
    </div>
  );
}
