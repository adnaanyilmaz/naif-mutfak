import { sha256Hex } from './crypto';
import { getBindings } from './env';

export interface Limiter {
  /** true = allowed. Missing binding (e.g. tooling without rate limits) fails open. */
  allow(key: string): Promise<boolean>;
}

function wrap(binding: RateLimit | undefined): Limiter {
  return {
    async allow(key) {
      if (!binding) return true;
      const { success } = await binding.limit({ key });
      return success;
    },
  };
}

export function getCheckoutLimiter(): Limiter {
  return wrap(getBindings().CHECKOUT_LIMITER);
}

export function getDownloadLimiter(): Limiter {
  return wrap(getBindings().DOWNLOAD_LIMITER);
}

/** Never key limits on raw IPs (PII in limiter storage); a salted hash is enough to bucket clients. */
export async function clientKey(headers: Headers): Promise<string> {
  const ip = headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return (await sha256Hex(`naif-mutfak:${ip}`)).slice(0, 32);
}
