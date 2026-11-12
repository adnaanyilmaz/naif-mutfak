import { describe, expect, it } from 'vitest';
import type { UploadObjectStore } from '@/lib/cloudflare/r2';
import type { UploadSigner } from '@/lib/cloudflare/r2-presign';
import type { AdminPostRecord, AdminPostsRepo, SavePostWrite } from '@/repositories/admin-posts';
import type { AdminProductRecord, AdminProductsRepo, SaveProductWrite } from '@/repositories/admin-products';
import type { AuditEntry } from '@/repositories/audit';
import { majorToMinor, minorToMajor } from '@/services/catalog/money';
import type { SavePostInput } from '@/validators/admin/post';
import type { SaveProductInput } from '@/validators/admin/product';
import type { AdminIdentity } from './auth.service';
import { savePost } from './posts-admin.service';
import { activationIssues, saveProduct } from './products-admin.service';
import { createUploadIntent, finalizeUpload, isDevUploadKey, type UploadDeps } from './upload.service';
import { isKeyForKind, sniffType } from './upload-policy';

const admin: AdminIdentity = { email: 'chef@naifmutfak.com', sub: 's', via: 'access' };
const POST = '11111111-1111-4111-8111-111111111111';
const PRODUCT = '22222222-2222-4222-8222-222222222222';
const VARIANT = '33333333-3333-4333-8333-333333333333';
const NEW_ID = '44444444-4444-4444-8444-444444444444';
const T0 = 1_700_000_000;

/* ───────────── Posts ───────────── */

function postRecord(over: Partial<AdminPostRecord> = {}): AdminPostRecord {
  return {
    id: POST,
    status: 'draft',
    category: 'bread',
    heroImageKey: 'posts/p/h.jpg',
    isRecipe: false,
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    baseServings: null,
    difficulty: null,
    featuredProductId: null,
    publishedAt: null,
    updatedAt: new Date(T0 * 1000),
    translations: [],
    ...over,
  };
}

function fakePostsRepo(record: AdminPostRecord, opts: { takenSlugs?: string[]; outcome?: 'saved' | 'conflict' } = {}) {
  const writes: SavePostWrite[] = [];
  const repo: AdminPostsRepo = {
    list: async () => [],
    find: async (id) => (id === record.id ? record : null),
    createDraft: async () => {},
    isSlugTaken: async (_l, slug) => (opts.takenSlugs ?? []).includes(slug),
    save: async (w) => {
      writes.push(w);
      return opts.outcome ?? 'saved';
    },
    setHeroImage: async () => null,
    exists: async (id) => id === record.id,
  };
  return { repo, writes };
}

const postInput = (over: Partial<SavePostInput> = {}): SavePostInput => ({
  postId: POST,
  expectedUpdatedAt: T0,
  post: {
    status: 'draft',
    category: 'bread',
    isRecipe: false,
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    baseServings: null,
    difficulty: null,
    featuredProductId: null,
  },
  translations: [
    {
      locale: 'en',
      title: 'Bread notes',
      slug: 'bread-notes',
      dek: 'A dek',
      bodyMd: 'Body',
      heroImageAlt: null,
      seoTitle: null,
      seoDescription: null,
      ingredients: null,
      instructions: null,
      keywords: [],
      cuisine: null,
      isPublished: true,
    },
  ],
  ...over,
});

const postDeps = (repo: AdminPostsRepo, now = new Date(T0 * 1000)) => ({
  posts: repo,
  siteUrl: 'https://naifmutfak.com',
  mediaBaseUrl: 'https://media.naifmutfak.com',
  now: () => now,
  newId: () => NEW_ID,
});

describe('savePost', () => {
  it('saves with a strictly increasing concurrency token, first-publish timestamp and minimal audit diff', async () => {
    const { repo, writes } = fakePostsRepo(postRecord());
    const result = await savePost(postDeps(repo), admin, postInput({ post: { ...postInput().post, status: 'published' } }));
    expect(result).toMatchObject({ ok: true, updatedAt: T0 + 1 });
    expect(result.ok && result.revalidate).toEqual(expect.arrayContaining(['/en/blog/bread-notes', '/en/blog', '/en']));
    const w = writes[0];
    expect(w?.nextUpdatedAt.getTime()).toBe((T0 + 1) * 1000);
    expect(w?.publishAt).toBeInstanceOf(Date);
    expect(w?.audit).toMatchObject({ actorEmail: admin.email, action: 'post.save', diff: { shared: ['status'], locales: [{ locale: 'en', created: true }] } });
  });

  it('maps a stale token to conflict', async () => {
    const { repo } = fakePostsRepo(postRecord(), { outcome: 'conflict' });
    expect(await savePost(postDeps(repo), admin, postInput())).toEqual({ ok: false, error: 'conflict' });
  });

  it('blocks publishing incomplete locales, published status without locales and taken slugs', async () => {
    const { repo, writes } = fakePostsRepo(postRecord(), { takenSlugs: ['bread-notes'] });
    const base = postInput();
    const t = base.translations[0];
    if (!t) throw new Error('fixture');
    const result = await savePost(postDeps(repo), admin, {
      ...base,
      post: { ...base.post, status: 'published' },
      translations: [{ ...t, dek: null, isPublished: false }],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error === 'invalid' && result.issues.map((i) => i.code).sort()).toEqual(['slug_taken', 'status_needs_locale']);
    expect(writes).toHaveLength(0);
    const again = await savePost(postDeps(fakePostsRepo(postRecord()).repo), admin, { ...base, translations: [{ ...t, dek: null }] });
    expect(!again.ok && again.error === 'invalid' && again.issues).toEqual([{ path: 'translations.en.dek', code: 'publish_dek' }]);
  });
});

/* ───────────── Products ───────────── */

function productRecord(over: Partial<AdminProductRecord> = {}): AdminProductRecord {
  return {
    id: PRODUCT,
    slug: 'baking-at-home',
    status: 'draft',
    pageCount: 148,
    coverImageKey: null,
    updatedAt: new Date(T0 * 1000),
    translations: [],
    variants: [
      {
        id: VARIANT,
        contentLocale: 'tr',
        sku: 'EBOOK-TR',
        priceTry: 34900,
        priceUsd: 1200,
        priceSar: 4500,
        lsVariantId: '100001',
        paddlePriceId: null,
        pdfR2Key: 'ebooks/p/v/x.pdf',
        pdfSizeBytes: 10,
        pdfSha256: 'ab',
        isActive: false,
      },
    ],
    ...over,
  };
}

function fakeProductsRepo(record: AdminProductRecord) {
  const writes: SaveProductWrite[] = [];
  const audits: AuditEntry[] = [];
  const repo: AdminProductsRepo = {
    list: async () => [],
    find: async (id) => (id === record.id ? record : null),
    createDraft: async () => {},
    save: async (w) => {
      writes.push(w);
      return 'saved';
    },
    setCover: async (id, key, audit) => {
      audits.push(audit);
      if (id !== record.id) return null;
      const previousKey = record.coverImageKey;
      record.coverImageKey = key;
      return { previousKey };
    },
    findVariantOwner: async (id) => (record.variants.some((v) => v.id === id) ? { productId: record.id } : null),
    setVariantPdf: async (id, file, audit) => {
      audits.push(audit);
      const v = record.variants.find((x) => x.id === id);
      if (!v) return null;
      const previousKey = v.pdfR2Key;
      v.pdfR2Key = file.key;
      v.pdfSha256 = file.sha256;
      return { previousKey };
    },
    listOptions: async () => [],
  };
  return { repo, writes, audits };
}

const productInput = (over: Partial<SaveProductInput> = {}): SaveProductInput => ({
  productId: PRODUCT,
  expectedUpdatedAt: T0,
  product: { slug: 'baking-at-home', status: 'active', pageCount: 148 },
  translations: [{ locale: 'tr', title: 'Evde Ekmek', subtitle: null, descriptionMd: '', coverAlt: null }],
  variants: [
    { id: VARIANT, contentLocale: 'tr', sku: 'EBOOK-TR', priceTry: '349', priceUsd: '12.5', priceSar: '45.00', lsVariantId: '100001', paddlePriceId: null, isActive: true },
  ],
  ...over,
});

describe('money', () => {
  it('converts major → minor without float drift', () => {
    expect(majorToMinor('349')).toBe(34900);
    expect(majorToMinor('12.5')).toBe(1250);
    expect(majorToMinor('0.29')).toBe(29);
    expect(majorToMinor('1.234')).toBeNull();
    expect(majorToMinor('-1')).toBeNull();
    expect(minorToMajor(4500)).toBe('45.00');
  });
});

describe('saveProduct', () => {
  const deps = (repo: AdminProductsRepo, provider: 'lemonsqueezy' | 'paddle' = 'lemonsqueezy') => ({
    products: repo,
    provider,
    mediaBaseUrl: 'https://media.naifmutfak.com',
    now: () => new Date(T0 * 1000),
    newId: () => NEW_ID,
  });

  it('stores minor-unit prices and activates a variant with PDF + MoR id', async () => {
    const { repo, writes } = fakeProductsRepo(productRecord());
    expect(await saveProduct(deps(repo), admin, productInput())).toMatchObject({ ok: true });
    expect(writes[0]?.variants[0]).toEqual({
      isNew: false,
      value: expect.objectContaining({ priceTry: 34900, priceUsd: 1250, priceSar: 4500, isActive: true }),
    });
  });

  it('refuses activation without the active provider id or a PDF, and active products without active editions', async () => {
    const { repo, writes } = fakeProductsRepo(productRecord());
    const r1 = await saveProduct(deps(repo, 'paddle'), admin, productInput());
    expect(!r1.ok && r1.error === 'invalid' && r1.issues).toEqual([{ path: 'variants.tr.paddlePriceId', code: 'activate_mor_id' }]);

    const r2 = await saveProduct(deps(repo), admin, {
      ...productInput(),
      variants: [
        { id: null, contentLocale: 'en', sku: 'EBOOK-EN', priceTry: '1', priceUsd: '1', priceSar: '1', lsVariantId: '9', paddlePriceId: null, isActive: true },
      ],
    });
    expect(!r2.ok && r2.error === 'invalid' && r2.issues.map((i) => i.code)).toEqual(['activate_pdf']);
    const r3 = await saveProduct(deps(repo), admin, { ...productInput(), variants: [] });
    expect(!r3.ok && r3.error === 'invalid' && r3.issues.map((i) => i.code)).toEqual(['activate_no_variant']);
    expect(writes).toHaveLength(0);
  });

  it('assigns ids to new editions', async () => {
    const { repo, writes } = fakeProductsRepo(productRecord());
    await saveProduct(deps(repo), admin, {
      ...productInput({ product: { slug: 'baking-at-home', status: 'draft', pageCount: null } }),
      variants: [
        { id: null, contentLocale: 'ar', sku: 'EBOOK-AR', priceTry: '1', priceUsd: '1', priceSar: '1', lsVariantId: null, paddlePriceId: null, isActive: false },
      ],
    });
    expect(writes[0]?.variants[0]).toMatchObject({ isNew: true, value: { id: NEW_ID, contentLocale: 'ar' } });
  });

  it('activationIssues is provider-specific', () => {
    expect(activationIssues({ contentLocale: 'en', lsVariantId: null, paddlePriceId: 'pri_x', pdfR2Key: 'k' }, 'paddle')).toEqual([]);
  });
});

/* ───────────── Uploads ───────────── */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n');

function memoryStore() {
  const objects = new Map<string, { bytes: Uint8Array; type: string | null }>();
  const deleted: string[] = [];
  const store: UploadObjectStore = {
    head: async (k) => {
      const o = objects.get(k);
      return o ? { size: o.bytes.length, contentType: o.type } : null;
    },
    readPrefix: async (k, n) => objects.get(k)?.bytes.slice(0, n) ?? null,
    sha256: async (k) => (objects.has(k) ? 'f'.repeat(64) : null),
    delete: async (k) => {
      objects.delete(k);
      deleted.push(k);
    },
    put: async () => {},
  };
  return { store, objects, deleted };
}

function uploadDeps(product = productRecord({ coverImageKey: `products/${PRODUCT}/old.png` })) {
  const media = memoryStore();
  const ebooks = memoryStore();
  const products = fakeProductsRepo(product);
  const deferred: Promise<unknown>[] = [];
  const signer: UploadSigner = { signPut: async (bucket, key, contentType) => ({ url: `https://r2/${bucket}/${key}`, method: 'PUT', headers: { 'Content-Type': contentType } }) };
  const deps: UploadDeps = {
    stores: { media: media.store, ebooks: ebooks.store },
    signer,
    posts: { exists: async (id) => id === POST, setHeroImage: async () => ({ previousKey: null }) },
    products: products.repo,
    audit: { record: async () => {} },
    mediaBaseUrl: 'https://media.naifmutfak.com',
    newId: () => NEW_ID,
    defer: (p) => deferred.push(p),
  };
  return { deps, media, ebooks, products, deferred };
}

describe('upload policy', () => {
  it('sniffs magic bytes', () => {
    expect(sniffType(PNG)).toBe('image/png');
    expect(sniffType(PDF)).toBe('application/pdf');
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffType(new TextEncoder().encode('\0\0\0\x1cftypavif'))).toBe('image/avif');
    expect(sniffType(new TextEncoder().encode('<svg onload=x>'))).toBeNull();
  });

  it('accepts only server-shaped keys under the entity prefix', () => {
    expect(isKeyForKind('post_hero', `posts/${POST}/${NEW_ID}.png`, `posts/${POST}/`)).toBe(true);
    expect(isKeyForKind('post_hero', `posts/${POST}/../x/${NEW_ID}.png`, `posts/${POST}/`)).toBe(false);
    expect(isKeyForKind('product_cover', `products/${PRODUCT}/${NEW_ID}.avif`, `products/${PRODUCT}/`)).toBe(false);
    expect(isDevUploadKey('ebooks', `ebooks/${PRODUCT}/${VARIANT}/${NEW_ID}.pdf`)).toBe(true);
    expect(isDevUploadKey('media', `ebooks/${PRODUCT}/${VARIANT}/${NEW_ID}.pdf`)).toBe(false);
  });
});

describe('upload intent + finalize', () => {
  it('signs a server-generated key and ignores the client filename', async () => {
    const { deps } = uploadDeps();
    const r = await createUploadIntent(deps, { kind: 'ebook_pdf', entityId: VARIANT, contentType: 'application/pdf', size: 1000, filename: '../../evil.sh' });
    expect(r).toMatchObject({ ok: true, key: `ebooks/${PRODUCT}/${VARIANT}/${NEW_ID}.pdf` });
    expect(r.ok && r.upload.headers['Content-Type']).toBe('application/pdf');
  });

  it('rejects disallowed types, oversized declarations and unknown entities', async () => {
    const { deps } = uploadDeps();
    const base = { entityId: POST, size: 10, filename: 'a' };
    expect(await createUploadIntent(deps, { ...base, kind: 'post_hero', contentType: 'image/svg+xml' })).toEqual({ ok: false, error: 'type' });
    expect(await createUploadIntent(deps, { ...base, kind: 'post_hero', contentType: 'image/png', size: 16 * 1024 * 1024 })).toEqual({ ok: false, error: 'size' });
    expect(await createUploadIntent(deps, { ...base, kind: 'product_cover', contentType: 'image/png' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('finalizes a cover, writes it, and deletes the previous object after responding', async () => {
    const { deps, media, products, deferred } = uploadDeps();
    const key = `products/${PRODUCT}/${NEW_ID}.png`;
    media.objects.set(key, { bytes: PNG, type: 'image/png' });
    const r = await finalizeUpload(deps, admin, { kind: 'product_cover', entityId: PRODUCT, key });
    expect(r).toEqual({ ok: true, key, publicUrl: `https://media.naifmutfak.com/products/${PRODUCT}/${NEW_ID}.png` });
    await Promise.all(deferred);
    expect(media.deleted).toEqual([`products/${PRODUCT}/old.png`]);
    expect(products.audits[0]).toMatchObject({ action: 'upload.product_cover', diff: { key, type: 'image/png' } });
  });

  it('deletes objects whose bytes do not match the declared type', async () => {
    const { deps, media } = uploadDeps();
    const key = `products/${PRODUCT}/${NEW_ID}.png`;
    media.objects.set(key, { bytes: new TextEncoder().encode('<html>not a png</html>'), type: 'image/png' });
    expect(await finalizeUpload(deps, admin, { kind: 'product_cover', entityId: PRODUCT, key })).toEqual({ ok: false, error: 'type' });
    expect(media.deleted).toEqual([key]);
  });

  it('records PDF size + SHA-256 and keeps old purchasers working until the swap', async () => {
    const { deps, ebooks, products } = uploadDeps();
    const key = `ebooks/${PRODUCT}/${VARIANT}/${NEW_ID}.pdf`;
    ebooks.objects.set(key, { bytes: PDF, type: 'application/pdf' });
    expect(await finalizeUpload(deps, admin, { kind: 'ebook_pdf', entityId: VARIANT, key })).toEqual({ ok: true, key, publicUrl: null });
    expect(products.audits[0]?.diff).toMatchObject({ sha256: 'f'.repeat(64), size: PDF.length });
  });

  it('refuses keys of another entity', async () => {
    const { deps } = uploadDeps();
    const other = '55555555-5555-4555-8555-555555555555';
    expect(await finalizeUpload(deps, admin, { kind: 'post_hero', entityId: POST, key: `posts/${other}/${NEW_ID}.png` })).toEqual({
      ok: false,
      error: 'bad_key',
    });
  });
});
