'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TranslationStatus } from '@/services/translation/content-hash';
import { TARGET_LOCALES, type TargetLocale } from '@/validators/admin/translation';
import { AdminCard, secondaryButton } from './AdminPage';
import { AlertIcon, CheckIcon } from './icons';

export type TranslateBarError = 'quota' | 'ai_unavailable' | 'model_output' | 'source_missing' | 'slug' | 'not_found' | 'invalid' | 'needs_confirm';

interface TranslateBarProps {
  statuses: Record<TargetLocale, TranslationStatus>;
  /** Why translating is unavailable right now (null = available). */
  blocked: 'unsaved' | 'no_source' | null;
  running: TargetLocale | null;
  errors: Partial<Record<TargetLocale, TranslateBarError>>;
  onTranslate: (locale: TargetLocale) => void;
}

export function TranslateBar({ statuses, blocked, running, errors, onTranslate }: TranslateBarProps) {
  const t = useTranslations('Admin');
  return (
    <AdminCard id="translate" title={t('translate.title')} hint={t('translate.hint')}>
      <ul className="divide-y divide-hairline">
        {TARGET_LOCALES.map((l) => (
          <TranslateRow
            key={l}
            locale={l}
            status={statuses[l]}
            disabled={blocked !== null || running !== null}
            running={running === l}
            error={errors[l]}
            onTranslate={() => onTranslate(l)}
          />
        ))}
      </ul>
      {blocked ? <p className="mt-3 text-[0.8125rem] text-muted">{t(blocked === 'unsaved' ? 'translate.saveFirst' : 'translate.errors.source_missing')}</p> : null}
    </AdminCard>
  );
}

function TranslateRow(props: {
  locale: TargetLocale;
  status: TranslationStatus;
  disabled: boolean;
  running: boolean;
  error: TranslateBarError | undefined;
  onTranslate: () => void;
}) {
  const t = useTranslations('Admin');
  const [open, setOpen] = useState(false);
  const { status } = props;
  const report = status.report;
  const count = report ? report.checks.length + report.review.length : 0;
  const listId = `translate-issues-${props.locale}`;

  return (
    <li className="py-3 first:pt-0 last:pb-0" aria-busy={props.running}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-20 font-semibold">{t(`locales.${props.locale}`)}</span>
        <span className="text-[0.8125rem] text-muted">{t(`translate.origin.${status.origin}`)}</span>
        {status.outdated ? (
          <span className="rounded-pill bg-terracotta-tint px-2.5 py-0.5 text-[0.75rem] font-semibold text-terracotta-deep">{t('translate.outdated')}</span>
        ) : null}
        {report && count === 0 && report.reviewed ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-olive-tint px-2.5 py-0.5 text-[0.75rem] font-semibold text-olive">
            <CheckIcon className="size-3.5" />
            {t('translate.clean')}
          </span>
        ) : null}
        {report && count > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-pill bg-terracotta-tint px-2.5 py-0.5 text-[0.75rem] font-semibold text-terracotta"
          >
            <AlertIcon className="size-3.5" />
            {t('translate.warnings', { count })}
          </button>
        ) : null}
        {report && !report.reviewed ? <span className="text-[0.75rem] text-muted">{t('translate.notReviewed')}</span> : null}
        <button type="button" onClick={props.onTranslate} disabled={props.disabled} className={`${secondaryButton} ms-auto max-sm:w-full max-sm:justify-center`}>
          {props.running ? t('translate.running') : t(status.origin === 'none' ? 'translate.translate' : 'translate.retranslate')}
        </button>
      </div>
      {open && report ? (
        <ul id={listId} className="mt-2 space-y-1 text-[0.8125rem]">
          {report.checks.map((c, i) => (
            <li key={`c${i}`} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              {t(`translate.checks.${c.code}`, { field: c.field })}
            </li>
          ))}
          {report.review.map((r, i) => (
            <li key={`r${i}`} className="flex items-start gap-2">
              <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${r.severity === 'error' ? 'bg-danger' : 'bg-brand'}`} />
              <span>
                <span className="font-semibold">{r.field}: </span>
                {r.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {props.error ? (
        <p role="alert" className="mt-2 flex items-center gap-2 text-[0.8125rem] text-danger">
          <AlertIcon className="size-4" />
          {t(`translate.errors.${props.error}`)}
        </p>
      ) : null}
    </li>
  );
}
