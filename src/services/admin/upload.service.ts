// Direct-to-R2 uploads (admin.md §3): intent → browser PUT → finalize (verify size/type/magic, write, audit).
import type { SignedUpload, UploadSigner } from '@/lib/cloudflare/r2-presign';
import type { UploadBucket, UploadObjectStore } from '@/lib/cloudflare/r2';
import type { AdminPostsRepo } from '@/repositories/admin-posts';
import type { AdminProductsRepo } from '@/repositories/admin-products';
import type { AuditRepo } from '@/repositories/audit';
import { mediaUrl } from '@/services/media/image-url';
import type { UploadFinalizeInput, UploadIntentInput, UploadKind } from '@/validators/admin/upload';
import type { AdminIdentity } from './auth.service';
import { allowedType, EXTENSIONS, isKeyForKind, keyPrefix, sniffType, UPLOAD_POLICY } from './upload-policy';

export interface UploadDeps {
  stores: Record<UploadBucket, UploadObjectStore>;
  signer: UploadSigner;
  posts: Pick<AdminPostsRepo, 'exists' | 'setHeroImage'>;
  products: Pick<AdminProductsRepo, 'find' | 'findVariantOwner' | 'setCover' | 'setVariantPdf'>;
  audit: AuditRepo;
  mediaBaseUrl: string;
  newId: () => string;
  /** ctx.waitUntil: post-response cleanup. */
  defer: (task: Promise<unknown>) => void;
}

export type UploadError = 'type' | 'size' | 'not_found' | 'bad_key' | 'missing_object';

export type IntentResult = { ok: true; key: string; upload: SignedUpload } | { ok: false; error: UploadError };
export type FinalizeResult = { ok: true; key: string; publicUrl: string | null } | { ok: false; error: UploadError };

/** Owner prefix for an entity, or null when the entity does not exist. */
async function resolvePrefix(deps: UploadDeps, kind: UploadKind, entityId: string): Promise<string | null> {
  switch (kind) {
    case 'post_hero':
    case 'step_image':
      return (await deps.posts.exists(entityId)) ? keyPrefix(kind, entityId) : null;
    case 'product_cover':
      return (await deps.products.find(entityId)) ? keyPrefix(kind, entityId) : null;
    case 'ebook_pdf': {
      const owner = await deps.products.findVariantOwner(entityId);
      return owner ? keyPrefix(kind, owner.productId, entityId) : null;
    }
  }
}

export async function createUploadIntent(deps: UploadDeps, input: UploadIntentInput): Promise<IntentResult> {
  const policy = UPLOAD_POLICY[input.kind];
  const type = allowedType(input.kind, input.contentType);
  if (!type) return { ok: false, error: 'type' };
  if (input.size > policy.maxBytes) return { ok: false, error: 'size' };
  const prefix = await resolvePrefix(deps, input.kind, input.entityId);
  if (!prefix) return { ok: false, error: 'not_found' };

  // Never derived from the client filename.
  const key = `${prefix}${deps.newId()}.${EXTENSIONS[type]}`;
  const upload = await deps.signer.signPut(policy.bucket, key, type);
  return { ok: true, key, upload };
}

export async function finalizeUpload(
  deps: UploadDeps,
  actor: AdminIdentity,
  input: UploadFinalizeInput,
): Promise<FinalizeResult> {
  const policy = UPLOAD_POLICY[input.kind];
  const store = deps.stores[policy.bucket];
  const prefix = await resolvePrefix(deps, input.kind, input.entityId);
  if (!prefix) return { ok: false, error: 'not_found' };
  if (!isKeyForKind(input.kind, input.key, prefix)) return { ok: false, error: 'bad_key' };

  const head = await store.head(input.key);
  if (!head) return { ok: false, error: 'missing_object' };

  const reject = async (error: UploadError): Promise<FinalizeResult> => {
    await store.delete(input.key);
    return { ok: false, error };
  };
  // Presigned PUTs cannot cap size: enforce here and delete offenders.
  if (head.size > policy.maxBytes || head.size === 0) return reject('size');
  const declared = head.contentType ? allowedType(input.kind, head.contentType) : null;
  const prefixBytes = await store.readPrefix(input.key, 16);
  const sniffed = prefixBytes ? sniffType(prefixBytes) : null;
  if (!declared || sniffed !== declared || !input.key.endsWith(`.${EXTENSIONS[declared]}`)) return reject('type');

  const audit = {
    actorEmail: actor.email,
    action: `upload.${input.kind}`,
    entityType: 'upload' as const,
    entityId: input.entityId,
    diff: { key: input.key, size: head.size, type: declared },
  };

  let previous: { previousKey: string | null } | null;
  switch (input.kind) {
    case 'post_hero':
      previous = await deps.posts.setHeroImage(input.entityId, input.key, audit);
      break;
    case 'product_cover':
      previous = await deps.products.setCover(input.entityId, input.key, audit);
      break;
    case 'ebook_pdf': {
      const sha256 = await store.sha256(input.key);
      if (!sha256) return { ok: false, error: 'missing_object' };
      previous = await deps.products.setVariantPdf(input.entityId, { key: input.key, sizeBytes: head.size, sha256 }, {
        ...audit,
        diff: { ...audit.diff, sha256 },
      });
      break;
    }
    case 'step_image':
      // The key is stored in the translation's instructions JSON when the post is saved.
      await deps.audit.record(audit);
      previous = { previousKey: null };
      break;
  }
  if (!previous) return reject('not_found');

  const old = previous.previousKey;
  if (old && old !== input.key) deps.defer(store.delete(old));
  return {
    ok: true,
    key: input.key,
    publicUrl: policy.bucket === 'media' ? mediaUrl(deps.mediaBaseUrl, input.key) : null,
  };
}

/** Local development PUT target: only server-shaped keys for the given bucket are accepted. */
export function isDevUploadKey(bucket: UploadBucket, key: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const media = new RegExp(`^(posts|products)/${uuid}/${uuid}\\.(jpg|png|webp|avif)$`);
  const ebooks = new RegExp(`^ebooks/${uuid}/${uuid}/${uuid}\\.pdf$`);
  return bucket === 'media' ? media.test(key) : ebooks.test(key);
}

/** Local PUT fallback: writes the body to the binding; finalize then verifies it like any R2 upload. */
export async function storeDevUpload(
  stores: UploadDeps['stores'],
  bucket: UploadBucket,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<boolean> {
  if (!isDevUploadKey(bucket, key)) return false;
  await stores[bucket].put(key, body, contentType);
  return true;
}
