'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/validators/content';
import { downloadTokenResponseSchema, orderStatusResponseSchema, type OrderView } from '@/validators/order-status-response';

const POLL_LIMIT_MS = 45_000;

type Phase = 'polling' | 'slow' | 'done';

function Spinner() {
  return <span aria-hidden className="inline-block size-5 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />;
}

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function CheckoutStatus({ locale, initial }: { locale: Locale; initial: OrderView }) {
  const t = useTranslations('Checkout');
  const format = useFormatter();
  const [order, setOrder] = useState<OrderView>(initial);
  const [phase, setPhase] = useState<Phase>(initial.state === 'pending' ? 'polling' : 'done');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const started = useRef(0);

  const fetchStatus = useCallback(async (): Promise<OrderView | null> => {
    try {
      const res = await fetch(`/api/orders/status?locale=${locale}`, { cache: 'no-store' });
      const body = orderStatusResponseSchema.safeParse(await res.json());
      return body.success ? body.data.order : null;
    } catch {
      return null;
    }
  }, [locale]);

  // Poll with gentle backoff while the webhook is in flight; give up after ~45 s (user can retry).
  useEffect(() => {
    if (phase !== 'polling') return;
    if (started.current === 0) started.current = Date.now();
    let delay = 1000;
    let timer = 0;
    let cancelled = false;
    const tick = async () => {
      const next = await fetchStatus();
      if (cancelled) return;
      if (next) setOrder(next);
      if (next && next.state !== 'pending') {
        setPhase('done');
        return;
      }
      if (Date.now() - started.current > POLL_LIMIT_MS) {
        setPhase('slow');
        return;
      }
      delay = Math.min(delay * 1.5, 4000);
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, fetchStatus]);

  async function download() {
    setDownloading(true);
    setDownloadError(false);
    try {
      const res = await fetch('/api/download/token', { method: 'POST' });
      const body = downloadTokenResponseSchema.safeParse(await res.json());
      if (!body.success) throw new Error('token');
      window.location.assign(body.data.url);
      const next = await fetchStatus();
      if (next) setOrder(next);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  if (order.state === 'no_order') {
    return (
      <div className="text-center">
        <h1 className="font-display text-h2 font-extrabold">{t('noOrderTitle')}</h1>
        <p className="mx-auto mt-4 max-w-md text-stone">{t('noOrderBody')}</p>
        <Link href="/ebooks" className="mt-8 inline-flex min-h-12 items-center rounded-pill bg-charcoal px-6 font-semibold text-white hover:bg-terracotta">
          {t('browse')}
        </Link>
      </div>
    );
  }

  const confirmed = order.state === 'paid';
  const steps = [
    { key: 'pay', done: true, active: false },
    { key: 'confirm', done: confirmed, active: order.state === 'pending' },
    { key: 'download', done: false, active: confirmed },
  ] as const;

  const title =
    order.state === 'paid'
      ? t('paidTitle')
      : order.state === 'refunded'
        ? t('refundedTitle')
        : order.state === 'failed'
          ? t('failedTitle')
          : phase === 'slow'
            ? t('slowTitle')
            : t('pendingTitle');
  const body =
    order.state === 'paid'
      ? t('paidBody')
      : order.state === 'refunded'
        ? t('refundedBody')
        : order.state === 'failed'
          ? t('failedBody')
          : phase === 'slow'
            ? t('slowBody')
            : t('pendingBody');

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div>
        <ol className="flex items-center gap-2 text-[0.8125rem] font-semibold">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`flex size-7 items-center justify-center rounded-full ${
                  s.done ? 'bg-olive text-white' : s.active ? 'bg-terracotta-tint text-terracotta-deep' : 'bg-linen text-muted'
                }`}
              >
                {s.done ? <Check /> : format.number(i + 1)}
              </span>
              <span className={s.done || s.active ? 'text-charcoal' : 'text-muted'}>{t(`steps.${s.key}`)}</span>
              {i < steps.length - 1 ? <span aria-hidden className="mx-1 h-px w-6 bg-hairline sm:w-10" /> : null}
            </li>
          ))}
        </ol>

        <div role="status" aria-live="polite" className="mt-8">
          <div className="flex items-center gap-3">
            {order.state === 'pending' && phase === 'polling' ? <Spinner /> : null}
            <h1 className="font-display text-h2 font-extrabold">{title}</h1>
          </div>
          <p className="mt-4 max-w-xl text-dek text-stone">{body}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {order.state === 'paid' ? (
            <>
              <button
                type="button"
                onClick={download}
                disabled={downloading || order.downloadsLeft === 0}
                className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-terracotta px-6 font-semibold text-white shadow-[0_8px_20px_-8px_rgb(180_83_9/0.6)] hover:bg-terracotta-deep disabled:opacity-60"
              >
                {downloading ? t('downloading') : t('download')}
                <span aria-hidden>↓</span>
              </button>
              <span className="text-[0.875rem] text-muted">{t('downloadsLeft', { n: order.downloadsLeft })}</span>
            </>
          ) : null}
          {phase === 'slow' && order.state === 'pending' ? (
            <button
              type="button"
              onClick={() => {
                started.current = 0;
                setPhase('polling');
              }}
              className="inline-flex min-h-12 items-center rounded-pill bg-charcoal px-6 font-semibold text-white hover:bg-terracotta"
            >
              {t('checkAgain')}
            </button>
          ) : null}
          {order.state === 'failed' || order.state === 'refunded' ? (
            <Link
              href={`/ebooks/${order.productSlug}`}
              className="inline-flex min-h-12 items-center rounded-pill border border-hairline bg-white px-6 font-semibold hover:border-charcoal"
            >
              {t('backToEbook')}
            </Link>
          ) : null}
        </div>
        {downloadError ? (
          <p role="alert" className="mt-3 text-[0.875rem] text-danger">
            {t('downloadError')}
          </p>
        ) : null}
      </div>

      <aside className="h-fit rounded-[1.5rem] border border-hairline bg-white p-5 shadow-card">
        <h2 className="font-display text-[1.0625rem] font-bold">{t('summary')}</h2>
        <dl className="mt-4 space-y-3 text-[0.9375rem]">
          <div>
            <dt className="text-[0.75rem] text-muted">{t('product')}</dt>
            <dd className="font-semibold">{order.productTitle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t('edition')}</dt>
            <dd className="font-semibold uppercase">{order.edition}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-hairline pt-3">
            <dt className="text-muted">{t('total')}</dt>
            <dd className="font-display text-[1.25rem] font-extrabold tabular-nums">{order.total}</dd>
          </div>
          <div className="flex justify-between gap-4 text-[0.75rem]">
            <dt className="text-muted">{t('orderRef')}</dt>
            <dd className="font-mono text-stone" dir="ltr">
              {order.orderRef.slice(0, 8).toUpperCase()}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
