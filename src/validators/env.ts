import { z } from 'zod';

/** Plain-string vars and secrets. Bindings (DB, R2) are typed by `wrangler types` and not parsed here. */
export const envSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'preview', 'production']),
  SITE_URL: z.url(),
  MEDIA_PUBLIC_URL: z.url(),
  PAYMENT_PROVIDER: z.enum(['lemonsqueezy', 'paddle']),
});

export type AppEnv = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function parseEnv(source: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return result.data;
}
