'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { SaveSocialLinksResult } from '@/services/settings/social.service';
import { SOCIAL_PLATFORMS, type SocialLinks, type SocialPlatform } from '@/services/settings/social-links';
import { primaryButton } from './AdminPage';
import { TextField } from './fields';

type Status = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; invalid: SocialPlatform[] };

const toForm = (links: SocialLinks): Record<SocialPlatform, string> => ({
  instagram: links.instagram ?? '',
  youtube: links.youtube ?? '',
  tiktok: links.tiktok ?? '',
});

interface SocialLinksFormProps {
  initial: SocialLinks;
  saveAction: (raw: unknown) => Promise<SaveSocialLinksResult>;
}

export function SocialLinksForm({ initial, saveAction }: SocialLinksFormProps) {
  const t = useTranslations('Admin');
  const [values, setValues] = useState(() => toForm(initial));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await saveAction(values);
      if (result.ok) {
        setValues(toForm(result.links));
        setStatus({ kind: 'saved' });
      } else {
        setStatus({ kind: 'error', invalid: result.invalid });
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      {SOCIAL_PLATFORMS.map((p) => (
        <TextField
          key={p}
          label={t(`social.platforms.${p}`)}
          hint={t(`social.placeholders.${p}`)}
          value={values[p]}
          inputMode="url"
          dir="ltr"
          maxLength={300}
          onChange={(v) => {
            setValues((s) => ({ ...s, [p]: v }));
            setStatus({ kind: 'idle' });
          }}
          error={status.kind === 'error' && status.invalid.includes(p) ? t('social.invalid') : null}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('common.saving') : t('common.save')}
        </button>
        <p aria-live="polite" className="text-[0.875rem]">
          {status.kind === 'saved' ? <span className="text-olive">{t('common.saved')}</span> : null}
          {status.kind === 'error' && status.invalid.length === 0 ? <span className="text-danger">{t('social.failed')}</span> : null}
        </p>
      </div>
    </form>
  );
}
