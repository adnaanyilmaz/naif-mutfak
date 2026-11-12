import { describe, expect, it } from 'vitest';
import type { ProductRecord } from '@/repositories/products';
import { sampleVariants } from '@/test/fakes';
import { formatPrice, toEbookView } from './catalog.service';

const product: ProductRecord = {
  id: 'p1',
  slug: 'baking-at-home',
  status: 'active',
  coverImageKey: null,
  pageCount: 148,
  translations: [
    { locale: 'tr', title: 'Evde Fırın', subtitle: null, descriptionMd: 'TR', coverAlt: null },
    { locale: 'ar', title: 'الخَبز في البيت', subtitle: null, descriptionMd: 'AR', coverAlt: 'غلاف' },
  ],
  variants: sampleVariants, // tr + en editions only
};

describe('pricing per locale', () => {
  it('formats minor units with the locale currency', () => {
    expect(formatPrice(34900, 'TRY', 'tr')).toBe('₺349,00');
    expect(formatPrice(1200, 'USD', 'en')).toBe('$12.00');
    expect(formatPrice(4500, 'SAR', 'ar')).toMatch(/٤٥[٫,]٠٠/);
  });

  it('maps tr→TRY, en→USD, ar→SAR', () => {
    expect(toEbookView(product, 'tr', '')?.price).toMatchObject({ currency: 'TRY', amountMinor: 34900 });
    expect(toEbookView(product, 'en', '')?.price).toMatchObject({ currency: 'USD', amountMinor: 1200 });
    expect(toEbookView(product, 'ar', '')?.price).toMatchObject({ currency: 'SAR', amountMinor: 4500 });
  });
});

describe('edition fallback', () => {
  it('uses the reader-language edition when it exists', () => {
    expect(toEbookView(product, 'en', '')).toMatchObject({ editionLocale: 'en', isFallbackEdition: false, title: 'Evde Fırın' });
  });

  it('falls back to the TR edition (badge) when no edition exists in that language', () => {
    expect(toEbookView(product, 'ar', '')).toMatchObject({ editionLocale: 'tr', isFallbackEdition: true, title: 'الخَبز في البيت' });
  });

  it('hides products without any sellable variant', () => {
    expect(toEbookView({ ...product, variants: [] }, 'tr', '')).toBeNull();
  });
});
