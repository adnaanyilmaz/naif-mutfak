'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { usePathname } from '@/i18n/navigation';

type Source = 'footer' | 'recipe_card' | 'ebook_callout' | 'popup';
type State = 'idle' | 'submitting' | 'success' | 'error' | 'invalid';

export function NewsletterForm({ source }: { source: Source }) {
  const t = useTranslations('Newsletter');
  const locale = useLocale();
  const pathname = usePathname();
  const id = useId();
  const [state, setState] = useState<State>('idle');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    if (typeof email !== 'string' || !e.currentTarget.checkValidity()) {
      setState('invalid');
      return;
    }
    setState('submitting');
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, source, consent: true, referrerPath: `/${locale}${pathname === '/' ? '' : pathname}` }),
      });
      setState(res.ok ? 'success' : res.status === 400 ? 'invalid' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <p role="status" className="rounded-card bg-olive-tint px-4 py-3 text-ui text-olive">
        {t('success')}
      </p>
    );
  }

  const message = state === 'error' ? t('error') : state === 'invalid' ? t('invalid') : '';
  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md" data-source={source}>
      <label htmlFor={`${id}-email`} className="sr-only">
        {t('emailLabel')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          placeholder={t('placeholder')}
          aria-invalid={state === 'invalid'}
          aria-describedby={`${id}-consent ${id}-msg`}
          dir="ltr"
          className="min-h-12 flex-1 rounded-card border border-hairline bg-paper px-4 text-ui text-start placeholder:text-muted focus:border-charcoal"
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="min-h-12 rounded-card bg-charcoal px-6 text-ui font-medium text-paper transition-colors duration-200 ease-editorial hover:bg-terracotta disabled:opacity-70"
        >
          {state === 'submitting' ? t('submitting') : t('submit')}
        </button>
      </div>
      <p id={`${id}-consent`} className="mt-3 text-ui text-stone">
        {t('consent')}
      </p>
      <p id={`${id}-msg`} role="alert" className="mt-1 text-ui text-danger">
        {message}
      </p>
    </form>
  );
}
