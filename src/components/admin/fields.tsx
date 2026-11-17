'use client';

import { useId, type ReactNode } from 'react';

const inputClass = 'mt-1 w-full rounded-card border border-hairline bg-paper px-3 py-2 aria-[invalid=true]:border-danger';

interface BaseProps {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  className?: string;
}

function Wrapper({ id, label, hint, error, className = '', children }: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-eyebrow text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-eyebrow text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends BaseProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  dir?: 'ltr' | 'rtl';
  lang?: string;
  multiline?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'url';
  maxLength?: number;
}

export function TextField({ value, onChange, onBlur, dir, lang, multiline, inputMode, maxLength, ...base }: TextFieldProps) {
  const id = useId();
  const common = {
    id,
    value,
    dir,
    lang,
    onBlur,
    maxLength,
    'aria-invalid': base.error ? true : undefined,
    className: inputClass,
  };
  return (
    <Wrapper id={id} {...base}>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type="text" inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
    </Wrapper>
  );
}

interface SelectFieldProps<V extends string> extends BaseProps {
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (v: V) => void;
}

export function SelectField<V extends string>({ value, options, onChange, ...base }: SelectFieldProps<V>) {
  const id = useId();
  return (
    <Wrapper id={id} {...base}>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) onChange(next.value);
        }}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
  describedBy,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <label className={`inline-flex min-h-10 items-center gap-2 md:min-h-0 ${disabled ? 'cursor-not-allowed text-muted' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-terracotta md:size-4"
      />
      <span>{label}</span>
    </label>
  );
}

export function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-10 shrink-0 items-center md:size-8 justify-center rounded-card border border-hairline bg-paper hover:bg-linen disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
}

export function replaceAt<T>(list: readonly T[], index: number, value: T): T[] {
  return list.map((v, i) => (i === index ? value : v));
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}
