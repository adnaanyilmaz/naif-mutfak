// Upload policy (admin.md §3): per-kind bucket, key pattern, types, size; magic-byte sniffing.
import type { UploadKind } from '@/validators/admin/upload';

export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'application/pdf';

const MB = 1024 * 1024;

export interface KindPolicy {
  bucket: 'media' | 'ebooks';
  types: readonly MediaType[];
  maxBytes: number;
}

export const UPLOAD_POLICY: Readonly<Record<UploadKind, KindPolicy>> = {
  post_hero: { bucket: 'media', types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], maxBytes: 15 * MB },
  step_image: { bucket: 'media', types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], maxBytes: 15 * MB },
  product_cover: { bucket: 'media', types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 10 * MB },
  ebook_pdf: { bucket: 'ebooks', types: ['application/pdf'], maxBytes: 200 * MB },
};

export const EXTENSIONS: Readonly<Record<MediaType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
};

export function allowedType(kind: UploadKind, contentType: string): MediaType | null {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return UPLOAD_POLICY[kind].types.find((t) => t === normalized) ?? null;
}

/** Key prefix for an upload; `ownerId` is the post/product id (the product id for PDFs). */
export function keyPrefix(kind: UploadKind, ownerId: string, variantId?: string): string {
  switch (kind) {
    case 'post_hero':
    case 'step_image':
      return `posts/${ownerId}/`;
    case 'product_cover':
      return `products/${ownerId}/`;
    case 'ebook_pdf':
      return `ebooks/${ownerId}/${variantId ?? ''}/`;
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Server-generated keys only: `{prefix}{uuid}.{ext}` with an extension allowed for the kind. */
export function isKeyForKind(kind: UploadKind, key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false;
  const exts = UPLOAD_POLICY[kind].types.map((t) => EXTENSIONS[t]).join('|');
  return new RegExp(`^${UUID}\\.(?:${exts})$`).test(key.slice(prefix.length));
}

const startsWith = (b: Uint8Array, sig: readonly number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Detects the real type from the first 16 bytes; null when unknown. */
export function sniffType(bytes: Uint8Array): MediaType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('ftyp'), 4) && (startsWith(bytes, ascii('avif'), 8) || startsWith(bytes, ascii('avis'), 8))) {
    return 'image/avif';
  }
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  return null;
}
