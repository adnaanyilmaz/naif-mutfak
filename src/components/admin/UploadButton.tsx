'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { UploadKind } from '@/validators/admin/upload';
import { uploadFile } from './upload-client';

interface UploadButtonProps {
  kind: UploadKind;
  entityId: string;
  accept: string;
  label: string;
  onUploaded: (key: string, publicUrl: string | null) => void;
}

export function UploadButton({ kind, entityId, accept, label, onUploaded }: UploadButtonProps) {
  const t = useTranslations('Admin');
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadFile(kind, entityId, file);
    setBusy(false);
    if (result.ok) onUploaded(result.key, result.publicUrl);
    else setError(t(`upload.error.${result.error}`));
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className={`cursor-pointer rounded-pill border border-hairline bg-paper px-3 py-1.5 hover:bg-linen ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {busy ? t('common.uploading') : label}
      </label>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={onChange} disabled={busy} />
      {error ? (
        <span role="alert" className="text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
