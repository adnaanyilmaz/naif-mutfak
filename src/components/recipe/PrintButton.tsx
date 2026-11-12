'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-pill border border-hairline bg-white px-4 text-ui font-semibold transition-colors duration-200 ease-editorial hover:border-charcoal print:hidden"
    >
      <span aria-hidden>⎙</span>
      {label}
    </button>
  );
}
