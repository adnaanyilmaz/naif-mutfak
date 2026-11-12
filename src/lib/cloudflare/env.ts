import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseEnv, type AppEnv } from '@/validators/env';

export type Bindings = CloudflareEnv;

/** Raw Cloudflare bindings (D1, R2, vars) for the current request. */
export function getBindings(): Bindings {
  return getCloudflareContext().env;
}

/** Validated string vars/secrets. Throws EnvValidationError on misconfiguration. */
export function getEnv(): AppEnv {
  return parseEnv({ ...getBindings() });
}

/** `ctx.waitUntil` for post-response side effects. */
export function waitUntil(promise: Promise<unknown>): void {
  getCloudflareContext().ctx.waitUntil(promise);
}
