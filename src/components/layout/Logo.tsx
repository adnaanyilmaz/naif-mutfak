/** Brand mark (official round logo) + wordmark. The brand name is Latin in every locale. */
export function Logo({ inverted = false, size = 40, wordmark = true }: { inverted?: boolean; size?: number; wordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" dir="ltr">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset, pre-sized */}
      <img
        src={size > 48 ? '/brand/logo-192.webp' : '/brand/logo-96.webp'}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full shadow-[0_4px_12px_-4px_rgb(238_128_5/0.55)]"
        style={{ width: size, height: size }}
      />
      {wordmark && (
        <span
          className={`font-[family-name:var(--font-jakarta)] text-[1.125rem] font-extrabold tracking-[-0.02em] ${inverted ? 'text-white' : 'text-charcoal'}`}
        >
          Naif Mutfak
        </span>
      )}
    </span>
  );
}
