'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

type DeleteError = 'not_found' | 'has_orders';

interface DangerZoneProps {
  kind: 'post' | 'product';
  entityId: string;
  /** Redirects on success; resolves with the reason when the delete is refused. */
  deleteAction: (id: string) => Promise<{ error: DeleteError }>;
}

/** Permanent delete, behind a confirmation, at the bottom of an admin edit page. */
export function DangerZone({ kind, entityId, deleteAction }: DangerZoneProps) {
  const t = useTranslations('Admin.danger');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<DeleteError | null>(null);

  const onDelete = () => {
    if (!window.confirm(t(`${kind}.confirm`))) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAction(entityId);
      setError(result.error);
    });
  };

  return (
    <section className="mx-auto mt-10 max-w-page px-4 pb-16 sm:px-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-danger/30 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-[1.0625rem] font-bold">{t(`${kind}.title`)}</h2>
          <p className="mt-1 max-w-2xl text-[0.875rem] text-stone">{t(`${kind}.body`)}</p>
          {error && (
            <p role="alert" className="mt-2 text-[0.875rem] font-semibold text-danger">
              {t(`errors.${error}`)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-pill border border-danger px-5 text-[0.9375rem] font-semibold text-danger transition-colors hover:bg-danger hover:text-white disabled:opacity-50"
        >
          {pending ? t('deleting') : t(`${kind}.button`)}
        </button>
      </div>
    </section>
  );
}
