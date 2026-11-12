'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

interface RevealEmailProps {
  orderId: string;
  masked: string | null;
  revealAction: (raw: unknown) => Promise<string | null>;
}

/** Masked by default; revealing is an explicit, audited action. */
export function RevealEmail({ orderId, masked, revealAction }: RevealEmailProps) {
  const t = useTranslations('Admin.common');
  const [email, setEmail] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!masked) return <span className="text-muted">{t('none')}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-[0.8125rem]">{email ?? masked}</span>
      {email ? null : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setEmail(await revealAction({ orderId })))}
          className="text-eyebrow text-terracotta underline-offset-4 hover:underline disabled:opacity-50"
        >
          {pending ? t('revealing') : t('reveal')}
        </button>
      )}
    </span>
  );
}
