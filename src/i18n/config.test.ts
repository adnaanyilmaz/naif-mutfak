import { describe, expect, it } from 'vitest';
import { getCurrency, getDirection, isLocale, LOCALES, LOCALE_META } from './config';

describe('i18n config', () => {
  it('maps only Arabic to rtl', () => {
    expect(LOCALES.map(getDirection)).toEqual(['ltr', 'ltr', 'rtl']);
  });

  it('maps storefront currency per locale', () => {
    expect(LOCALES.map(getCurrency)).toEqual(['TRY', 'USD', 'SAR']);
  });

  it('uses the Arabic script for ar only', () => {
    expect(LOCALE_META.ar.script).toBe('arabic');
    expect(LOCALE_META.tr.script).toBe('latin');
  });

  it('guards locale strings', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
