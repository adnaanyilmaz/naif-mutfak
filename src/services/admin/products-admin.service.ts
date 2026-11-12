// Admin catalog editing (admin.md §2 "Products"): major→minor prices, activation rules, optimistic concurrency.
import type {
  AdminProductRecord,
  AdminProductsRepo,
  AdminVariant,
  VariantWrite,
} from '@/repositories/admin-products';
import { majorToMinor, minorToMajor } from '@/services/catalog/money';
import { mediaUrl } from '@/services/media/image-url';
import type { SaveProductInput, VariantInput } from '@/validators/admin/product';
import type { AdminIdentity } from './auth.service';

export type PaymentProviderId = 'lemonsqueezy' | 'paddle';

export interface AdminProductsDeps {
  products: AdminProductsRepo;
  provider: PaymentProviderId;
  mediaBaseUrl: string;
  now: () => Date;
  newId: () => string;
}

export type ProductIssueCode =
  | 'invalid'
  | 'price'
  | 'activate_pdf'
  | 'activate_mor_id'
  | 'activate_no_variant'
  | 'slug_taken'
  | 'sku_taken'
  | 'mor_taken'
  | 'edition_taken';

export interface ProductIssue {
  path: string;
  code: ProductIssueCode;
}

export type SaveProductResult =
  | { ok: true; updatedAt: number; revalidate: string[] }
  | { ok: false; error: 'not_found' | 'conflict' }
  | { ok: false; error: 'invalid'; issues: ProductIssue[] };

const toSeconds = (d: Date) => Math.floor(d.getTime() / 1000);

/** A variant may be sold only with a PDF in R2 and a MoR id for the active provider. */
export function activationIssues(
  v: Pick<AdminVariant, 'contentLocale' | 'lsVariantId' | 'paddlePriceId' | 'pdfR2Key'>,
  provider: PaymentProviderId,
): ProductIssue[] {
  const at = `variants.${v.contentLocale}`;
  const issues: ProductIssue[] = [];
  if (!v.pdfR2Key) issues.push({ path: `${at}.pdf`, code: 'activate_pdf' });
  const morId = provider === 'lemonsqueezy' ? v.lsVariantId : v.paddlePriceId;
  if (!morId) issues.push({ path: `${at}.${provider === 'lemonsqueezy' ? 'lsVariantId' : 'paddlePriceId'}`, code: 'activate_mor_id' });
  return issues;
}

function toVariantWrite(v: VariantInput, id: string): VariantWrite | null {
  const priceTry = majorToMinor(v.priceTry);
  const priceUsd = majorToMinor(v.priceUsd);
  const priceSar = majorToMinor(v.priceSar);
  if (priceTry === null || priceUsd === null || priceSar === null) return null;
  return {
    id,
    contentLocale: v.contentLocale,
    sku: v.sku,
    priceTry,
    priceUsd,
    priceSar,
    lsVariantId: v.lsVariantId,
    paddlePriceId: v.paddlePriceId,
    isActive: v.isActive,
  };
}

export async function saveProduct(
  deps: AdminProductsDeps,
  actor: AdminIdentity,
  input: SaveProductInput,
): Promise<SaveProductResult> {
  const existing = await deps.products.find(input.productId);
  if (!existing) return { ok: false, error: 'not_found' };

  const issues: ProductIssue[] = [];
  const variants: { value: VariantWrite; isNew: boolean }[] = [];
  for (const v of input.variants) {
    const current = v.id ? existing.variants.find((e) => e.id === v.id) : undefined;
    if (v.id && !current) {
      issues.push({ path: `variants.${v.contentLocale}`, code: 'invalid' });
      continue;
    }
    const value = toVariantWrite(v, current?.id ?? deps.newId());
    if (!value) {
      issues.push({ path: `variants.${v.contentLocale}.price`, code: 'price' });
      continue;
    }
    if (value.isActive) issues.push(...activationIssues({ ...value, pdfR2Key: current?.pdfR2Key ?? null }, deps.provider));
    variants.push({ value, isNew: !current });
  }
  if (input.product.status === 'active' && !variants.some((v) => v.value.isActive)) {
    issues.push({ path: 'product.status', code: 'activate_no_variant' });
  }
  if (issues.length > 0) return { ok: false, error: 'invalid', issues };

  const now = deps.now();
  const next = new Date(Math.max(toSeconds(now), input.expectedUpdatedAt + 1) * 1000);
  const outcome = await deps.products.save({
    productId: input.productId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt * 1000),
    nextUpdatedAt: next,
    product: input.product,
    translations: input.translations,
    variants,
    audit: {
      actorEmail: actor.email,
      action: 'product.save',
      entityType: 'product',
      entityId: input.productId,
      diff: {
        status: existing.status === input.product.status ? undefined : input.product.status,
        locales: input.translations.map((t) => t.locale),
        variants: variants.map((v) => ({ id: v.value.id, isNew: v.isNew, isActive: v.value.isActive })),
      },
    },
  });
  if (outcome === 'conflict') return { ok: false, error: 'conflict' };
  if (outcome !== 'saved') {
    const path = outcome === 'slug_taken' ? 'product.slug' : 'variants';
    return { ok: false, error: 'invalid', issues: [{ path, code: outcome }] };
  }

  const slugs = new Set([existing.slug, input.product.slug]);
  const revalidate = ['tr', 'en', 'ar'].flatMap((l) => [`/${l}/ebooks`, ...[...slugs].map((s) => `/${l}/ebooks/${s}`)]);
  return { ok: true, updatedAt: toSeconds(next), revalidate };
}

export async function createDraftProduct(deps: AdminProductsDeps, actor: AdminIdentity): Promise<string> {
  const id = deps.newId();
  await deps.products.createDraft(
    { id, slug: `draft-${id.slice(0, 8)}` },
    { actorEmail: actor.email, action: 'product.create', entityType: 'product', entityId: id, diff: null },
  );
  return id;
}

export interface VariantEditView extends Omit<AdminVariant, 'priceTry' | 'priceUsd' | 'priceSar'> {
  priceTry: string;
  priceUsd: string;
  priceSar: string;
}

export interface AdminProductEditView {
  product: Omit<AdminProductRecord, 'variants'>;
  variants: VariantEditView[];
  updatedAtSeconds: number;
  coverImageUrl: string | null;
  provider: PaymentProviderId;
}

export async function getProductForEdit(deps: AdminProductsDeps, id: string): Promise<AdminProductEditView | null> {
  const record = await deps.products.find(id);
  if (!record) return null;
  const { variants, ...product } = record;
  return {
    product,
    variants: variants.map((v) => ({
      ...v,
      priceTry: minorToMajor(v.priceTry),
      priceUsd: minorToMajor(v.priceUsd),
      priceSar: minorToMajor(v.priceSar),
    })),
    updatedAtSeconds: toSeconds(record.updatedAt),
    coverImageUrl: record.coverImageKey ? mediaUrl(deps.mediaBaseUrl, record.coverImageKey) : null,
    provider: deps.provider,
  };
}

export async function listAdminProducts(deps: AdminProductsDeps) {
  return deps.products.list();
}

export async function listProductOptions(deps: AdminProductsDeps) {
  return deps.products.listOptions();
}
