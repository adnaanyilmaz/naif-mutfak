import { getCurrency, LOCALE_META } from '@/i18n/config';
import type { ProductRecord, ProductsRepo, VariantRecord } from '@/repositories/products';
import { parseMarkdown, type ParsedMarkdown } from '@/services/content/markdown';
import { mediaUrl } from '@/services/media/image-url';
import type { Currency, Locale } from '@/validators/content';

export interface CatalogDeps {
  products: ProductsRepo;
  mediaBaseUrl: string;
}

export interface Price {
  amountMinor: number;
  currency: Currency;
  formatted: string;
}

export interface EbookView {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: ParsedMarkdown;
  coverAlt: string;
  coverUrl: string | null;
  pageCount: number | null;
  variantId: string;
  /** Language of the PDF actually sold to this reader. */
  editionLocale: Locale;
  /** True when no edition exists in the reader's language and the TR edition is offered. */
  isFallbackEdition: boolean;
  price: Price;
}

const PRICE_COLUMN: Record<Currency, 'priceTry' | 'priceUsd' | 'priceSar'> = {
  TRY: 'priceTry',
  USD: 'priceUsd',
  SAR: 'priceSar',
};

export function formatPrice(amountMinor: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_META[locale].intlTag, { style: 'currency', currency }).format(amountMinor / 100);
}

/** Display price for the reader's locale (tr→TRY, en→USD, ar→SAR). The MoR's charged amount is authoritative. */
export function priceFor(variant: VariantRecord, locale: Locale): Price {
  const currency = getCurrency(locale);
  const amountMinor = variant[PRICE_COLUMN[currency]];
  return { amountMinor, currency, formatted: formatPrice(amountMinor, currency, locale) };
}

export function pickVariant(variants: VariantRecord[], locale: Locale): VariantRecord | null {
  return variants.find((v) => v.contentLocale === locale) ?? variants.find((v) => v.contentLocale === 'tr') ?? null;
}

export function toEbookView(p: ProductRecord, locale: Locale, mediaBaseUrl: string): EbookView | null {
  const translation = p.translations.find((t) => t.locale === locale) ?? p.translations.find((t) => t.locale === 'tr');
  const variant = pickVariant(p.variants, locale);
  if (!translation || !variant) return null;
  return {
    id: p.id,
    slug: p.slug,
    title: translation.title,
    subtitle: translation.subtitle,
    description: parseMarkdown(translation.descriptionMd),
    coverAlt: translation.coverAlt ?? translation.title,
    coverUrl: p.coverImageKey ? mediaUrl(mediaBaseUrl, p.coverImageKey, 768) : null,
    pageCount: p.pageCount,
    variantId: variant.id,
    editionLocale: variant.contentLocale,
    isFallbackEdition: variant.contentLocale !== locale,
    price: priceFor(variant, locale),
  };
}

function toViews(records: ProductRecord[], locale: Locale, mediaBaseUrl: string): EbookView[] {
  return records.map((r) => toEbookView(r, locale, mediaBaseUrl)).filter((v): v is EbookView => v !== null);
}

export async function listEbooks(deps: CatalogDeps, locale: Locale): Promise<EbookView[]> {
  return toViews(await deps.products.listActive(locale), locale, deps.mediaBaseUrl);
}

export async function getEbook(deps: CatalogDeps, locale: Locale, slug: string): Promise<EbookView | null> {
  const [view] = toViews(await deps.products.findActiveBySlugs(locale, [slug]), locale, deps.mediaBaseUrl);
  return view ?? null;
}

export async function getEbooksBySlugs(
  deps: CatalogDeps,
  locale: Locale,
  slugs: readonly string[],
): Promise<Record<string, EbookView>> {
  const views = toViews(await deps.products.findActiveBySlugs(locale, slugs), locale, deps.mediaBaseUrl);
  return Object.fromEntries(views.map((v) => [v.slug, v]));
}
