/** "12", "12.5", "12.50" → 1250. String arithmetic, no float rounding. Null on bad input. */
export function majorToMinor(major: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(major.trim());
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  return whole * 100 + frac;
}

/** 1250 → "12.50" (editor value; display formatting uses Intl). */
export function minorToMajor(minor: number): string {
  const whole = Math.floor(minor / 100);
  return `${whole}.${String(minor % 100).padStart(2, '0')}`;
}
