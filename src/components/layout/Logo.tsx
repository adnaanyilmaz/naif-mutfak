/** Wordmark: orange tile with a bowl glyph + "naif mutfak". The brand name is Latin in every locale. */
export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" dir="ltr">
      <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-terracotta text-white shadow-[0_6px_16px_-6px_rgb(194_65_12/0.7)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M3 12h18a9 9 0 0 1-18 0Z" />
          <path d="M9 8.5c-.8-1.2.8-2 0-3.3M15 8.5c-.8-1.2.8-2 0-3.3" />
        </svg>
      </span>
      <span
        className={`font-[family-name:var(--font-jakarta)] text-[1.1875rem] font-extrabold tracking-[-0.03em] ${inverted ? 'text-white' : 'text-charcoal'}`}
      >
        naif mutfak
      </span>
    </span>
  );
}
