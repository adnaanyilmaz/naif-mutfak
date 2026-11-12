import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseEnv, parsePaymentEnv, type AppEnv, type PaymentEnv } from '@/validators/env';

export type Bindings = CloudflareEnv;

/** Raw Cloudflare bindings (D1, R2, vars) for the current request. */
export function getBindings(): Bindings {
  return getCloudflareContext().env;
}

/** Validated string vars/secrets. Throws EnvValidationError on misconfiguration. */
export function getEnv(): AppEnv {
  return parseEnv({ ...getBindings() });
}

/** Payment/delivery secrets. Throws EnvValidationError when the active provider is not configured. */
export function getPaymentEnv(): PaymentEnv {
  return parsePaymentEnv({ ...getBindings() });
}

/** `ctx.waitUntil` for post-response side effects. */
export function waitUntil(promise: Promise<unknown>): void {
  getCloudflareContext().ctx.waitUntil(promise);
}
