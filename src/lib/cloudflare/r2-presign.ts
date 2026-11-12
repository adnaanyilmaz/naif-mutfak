// Presigned PUT via R2's S3-compatible API (bindings cannot presign). aws4fetch = Web Crypto, Workers-safe.
import { AwsClient } from 'aws4fetch';

export interface SignedUpload {
  url: string;
  method: 'PUT';
  /** Headers the browser must send unchanged (Content-Type is part of the signature). */
  headers: Record<string, string>;
}

export interface UploadSigner {
  signPut(bucket: 'media' | 'ebooks', key: string, contentType: string): Promise<SignedUpload>;
}

export interface R2PresignConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketNames: Record<'media' | 'ebooks', string>;
  ttlSeconds: number;
}

export function createR2Signer(cfg: R2PresignConfig): UploadSigner {
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  return {
    async signPut(bucket, key, contentType) {
      const path = key.split('/').map(encodeURIComponent).join('/');
      const url = new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucketNames[bucket]}/${path}`);
      url.searchParams.set('X-Amz-Expires', String(cfg.ttlSeconds));
      const signed = await client.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), {
        aws: { signQuery: true },
      });
      return { url: signed.url, method: 'PUT', headers: { 'Content-Type': contentType } };
    },
  };
}

/** Local development: no S3 credentials, so the browser PUTs to an admin-only route that writes the binding. */
export function createDevSigner(siteUrl: string): UploadSigner {
  return {
    async signPut(bucket, key, contentType) {
      const url = new URL('/api/admin/uploads/dev', siteUrl);
      url.searchParams.set('bucket', bucket);
      url.searchParams.set('key', key);
      return { url: url.toString(), method: 'PUT', headers: { 'Content-Type': contentType } };
    },
  };
}
