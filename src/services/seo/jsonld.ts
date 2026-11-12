const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serializes JSON-LD for `<script type="application/ld+json">`.
 * Escapes `<` (prevents `</script>` breakout) and U+2028/U+2029 line separators.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

/** ISO 8601 duration from minutes, e.g. 115 → "PT1H55M". */
export function toIsoDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `PT${rest}M`;
  return rest === 0 ? `PT${h}H` : `PT${h}H${rest}M`;
}
