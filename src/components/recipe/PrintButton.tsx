'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-card border border-charcoal px-4 text-ui font-medium transition-colors duration-200 ease-editorial hover:bg-charcoal hover:text-paper print:hidden"
    >
      <span aria-hidden>⎙</span>
      {label}
    </button>
  );
}
