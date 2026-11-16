import type { ReactNode } from 'react';

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="rounded-card border border-hairline bg-paper p-4">
      <p className="text-eyebrow uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-h3 tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-eyebrow text-stone">{sub}</p> : null}
    </div>
  );
}

export function Panel({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="rounded-card border border-hairline bg-paper p-4 md:p-5">
      <h2 className="font-display text-h3">{title}</h2>
      {hint ? <p className="mt-1 text-eyebrow text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const filterControl = 'min-h-10 w-full min-w-0 rounded-card border border-hairline bg-paper px-2 md:min-h-0 md:py-1.5';
/** Text links in admin toolbars/pagination: 40px tall on phones. */
export const touchLink = 'inline-flex min-h-10 items-center underline md:min-h-0';

interface FilterFieldProps {
  name: string;
  label: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
}

export function FilterSelect({ name, label, value, options }: FilterFieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-eyebrow text-muted">{label}</span>
      <select name={name} defaultValue={value ?? ''} className={filterControl}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDate({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-eyebrow text-muted">{label}</span>
      <input type="date" name={name} defaultValue={value} className={filterControl} />
    </label>
  );
}

/** Rebuilds a query string from current params with overrides (null removes a key). */
export function withParams(base: Record<string, string | undefined>, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
}
