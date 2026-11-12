import Link from 'next/link';
import type { ReactNode } from 'react';
import { BackIcon } from './icons';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
}

/** Page title row used by every admin screen. */
export function AdminPageHeader({ title, subtitle, back, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-charcoal">
            <BackIcon className="size-4 rtl:-scale-x-100" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
        {subtitle ? <p className="mt-1 text-stone">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** White card section with an optional heading and helper text. */
export function AdminCard({
  title,
  hint,
  children,
  className = '',
  id,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className={`rounded-2xl border border-hairline bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] md:p-6 ${className}`}>
      {title ? (
        <div className="mb-5">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-[1.0625rem] font-bold">
            {title}
          </h2>
          {hint ? <p className="mt-1 text-[0.8125rem] text-muted">{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-hairline bg-white px-6 py-16 text-center">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-terracotta-tint text-2xl">🍞</span>
      <h2 className="mt-4 font-display text-[1.125rem] font-bold">{title}</h2>
      <p className="mt-1 max-w-sm text-stone">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export const primaryButton =
  'inline-flex min-h-10 items-center gap-2 rounded-pill bg-charcoal px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-terracotta disabled:opacity-50';
export const secondaryButton =
  'inline-flex min-h-10 items-center gap-2 rounded-pill border border-hairline bg-white px-5 text-[0.9375rem] font-semibold transition-colors hover:border-charcoal disabled:opacity-50';
export const accentButton =
  'inline-flex min-h-10 items-center gap-2 rounded-pill bg-terracotta px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-terracotta-deep disabled:opacity-50';

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-olive-tint text-olive',
  active: 'bg-olive-tint text-olive',
  paid: 'bg-olive-tint text-olive',
  processed: 'bg-olive-tint text-olive',
  draft: 'bg-linen text-stone',
  pending: 'bg-[#fff4d6] text-[#8a5a00]',
  archived: 'bg-linen text-muted',
  refunded: 'bg-linen text-stone',
  ignored: 'bg-linen text-stone',
  failed: 'bg-[#fdecea] text-danger',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[0.75rem] font-semibold ${STATUS_STYLE[status] ?? 'bg-linen text-stone'}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
