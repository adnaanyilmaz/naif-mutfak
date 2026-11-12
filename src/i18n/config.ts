import { LOCALES, type Currency, type Locale } from '@/validators/content';

export { LOCALES, type Locale };

export const DEFAULT_LOCALE: Locale = 'tr';

export type Direction = 'ltr' | 'rtl';
export type Script = 'latin' | 'arabic';

interface LocaleMeta {
  dir: Direction;
  script: Script;
  currency: Currency;
  /** BCP 47 tag for Intl/`hreflang`/OpenGraph. */
  intlTag: string;
  ogLocale: string;
  /** Endonym shown in the locale switcher. */
  label: string;
}

export const LOCALE_META: Readonly<Record<Locale, LocaleMeta>> = {
  tr: { dir: 'ltr', script: 'latin', currency: 'TRY', intlTag: 'tr-TR', ogLocale: 'tr_TR', label: 'Türkçe' },
  en: { dir: 'ltr', script: 'latin', currency: 'USD', intlTag: 'en-US', ogLocale: 'en_US', label: 'English' },
  ar: { dir: 'rtl', script: 'arabic', currency: 'SAR', intlTag: 'ar-SA', ogLocale: 'ar_SA', label: 'العربية' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getDirection(locale: Locale): Direction {
  return LOCALE_META[locale].dir;
}

export function getCurrency(locale: Locale): Currency {
  return LOCALE_META[locale].currency;
}
