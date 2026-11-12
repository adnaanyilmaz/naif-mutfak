import { LOCALE_META } from '@/i18n/config';
import type { Locale } from '@/validators/content';

/** Units that are rounded to whole numbers (metric mass / volume). Localized spellings included. */
const METRIC_UNITS = new Set(['g', 'gr', 'kg', 'ml', 'l', 'غ', 'غرام', 'مل', 'كغ', 'ل']);

const FRACTIONS: readonly (readonly [number, string])[] = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [1, ''],
];

export function isMetricUnit(unit: string | undefined): boolean {
  return unit !== undefined && METRIC_UNITS.has(unit.trim().toLowerCase());
}

/** Grams/ml: 1 g precision below 100, 5 g above. */
export function roundMetric(value: number): number {
  if (value < 100) return Math.max(1, Math.round(value));
  return Math.round(value / 5) * 5;
}

/** Nearest common fraction: returns whole part and Unicode fraction glyph ('' if none). */
export function toFraction(value: number): { whole: number; fraction: string } {
  let whole = Math.floor(value);
  const rest = value - whole;
  let best: readonly [number, string] = [0, ''];
  for (const f of FRACTIONS) if (Math.abs(rest - f[0]) < Math.abs(rest - best[0])) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = [0, ''];
  }
  if (whole === 0 && best[1] === '') return { whole: 0, fraction: '⅛' }; // never render "0"
  return { whole, fraction: best[1] };
}

/**
 * Formats one quantity for display.
 * TR/EN: Unicode fractions for non-metric units; AR: decimals (fractions read poorly in RTL).
 */
export function formatQuantity(value: number, opts: { locale: Locale; unit?: string | undefined }): string {
  const tag = LOCALE_META[opts.locale].intlTag;
  if (isMetricUnit(opts.unit)) {
    return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(roundMetric(value));
  }
  if (opts.locale === 'ar') {
    return new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(Math.round(value * 100) / 100);
  }
  const { whole, fraction } = toFraction(value);
  const wholeText = whole > 0 ? new Intl.NumberFormat(tag).format(whole) : '';
  return `${wholeText}${fraction}` || '0';
}
