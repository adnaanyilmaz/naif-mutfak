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
