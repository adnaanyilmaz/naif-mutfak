import { bytesToHex } from './crypto';
import { getBindings } from './env';

export interface StoredObject {
  body: ReadableStream;
  size: number;
}

export interface PrivateFileStore {
  get(key: string): Promise<StoredObject | null>;
}

/** Private e-book bucket. Never listed, never public. */
export function getPrivateEbookStore(): PrivateFileStore {
  const bucket = getBindings().EBOOKS_PRIVATE;
  return {
    async get(key) {
      const obj = await bucket.get(key);
      return obj ? { body: obj.body, size: obj.size } : null;
    },
  };
}

export type UploadBucket = 'media' | 'ebooks';

export interface ObjectHead {
  size: number;
  contentType: string | null;
}

/** Operations the upload finalize step needs (admin.md §3). */
export interface UploadObjectStore {
  head(key: string): Promise<ObjectHead | null>;
  /** First `length` bytes (magic-number sniffing). */
  readPrefix(key: string, length: number): Promise<Uint8Array | null>;
  /** Streams the object through SHA-256 (DigestStream on Workers). */
  sha256(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  /** Local development PUT fallback only. */
  put(key: string, body: ReadableStream | ArrayBuffer, contentType: string): Promise<void>;
}

async function digest(body: ReadableStream): Promise<string> {
  if (typeof DigestStream === 'function') {
    const stream = new DigestStream('SHA-256');
    await body.pipeTo(stream);
    return bytesToHex(new Uint8Array(await stream.digest));
  }
  // `next dev` (Node + platform proxy) has no DigestStream; buffer instead (dev-sized files only).
  const buf = await new Response(body).arrayBuffer();
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)));
}

function storeFor(bucket: R2Bucket): UploadObjectStore {
  return {
    async head(key) {
      const obj = await bucket.head(key);
      return obj ? { size: obj.size, contentType: obj.httpMetadata?.contentType ?? null } : null;
    },
    async readPrefix(key, length) {
      const obj = await bucket.get(key, { range: { offset: 0, length } });
      return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
    },
    async sha256(key) {
      const obj = await bucket.get(key);
      return obj ? digest(obj.body) : null;
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
    },
  };
}

export function getUploadStores(): Record<UploadBucket, UploadObjectStore> {
  const env = getBindings();
  return { media: storeFor(env.MEDIA_PUBLIC), ebooks: storeFor(env.EBOOKS_PRIVATE) };
}

/** Public media object for the local `/media/*` dev route. */
export async function getPublicMediaObject(key: string): Promise<{ body: ReadableStream; contentType: string | null; size: number } | null> {
  const obj = await getBindings().MEDIA_PUBLIC.get(key);
  return obj ? { body: obj.body, contentType: obj.httpMetadata?.contentType ?? null, size: obj.size } : null;
}
