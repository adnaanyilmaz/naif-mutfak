import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  parseAiEnv,
  type AiEnv,
  parseAdminEnv,
  parseEnv,
  parsePaymentEnv,
  parseUploadEnv,
  type AdminEnv,
  type AppEnv,
  type PaymentEnv,
  type UploadEnv,
} from '@/validators/env';

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

/** Admin auth config (Access team/audience, allowlist). */
export function getAdminEnv(): AdminEnv {
  return parseAdminEnv({ ...getBindings() });
}

/** R2 presign credentials and bucket names. */
export function getUploadEnv(): UploadEnv {
  return parseUploadEnv({ ...getBindings() });
}

/** Workers AI model ids for admin auto-translation. */
export function getAiEnv(): AiEnv {
  return parseAiEnv({ ...getBindings() });
}

/** `ctx.waitUntil` for post-response side effects. */
export function waitUntil(promise: Promise<unknown>): void {
  getCloudflareContext().ctx.waitUntil(promise);
}

/** Whether a var/secret is set (non-empty). Never exposes the value. */
export function isConfigured(name: string): boolean {
  const raw: Record<string, unknown> = { ...getBindings() };
  const v = raw[name];
  return typeof v === 'string' && v.trim().length > 0;
}
