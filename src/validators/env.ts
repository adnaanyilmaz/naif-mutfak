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

/** Payment/delivery secrets. Parsed lazily, only by payment routes. */
export const paymentEnvSchema = z
  .object({
    SITE_URL: z.url(),
    PAYMENT_PROVIDER: z.enum(['lemonsqueezy', 'paddle']),
    DOWNLOAD_SIGNING_SECRET: z.string().min(32),
    LEMONSQUEEZY_API_KEY: z.string().min(1).optional(),
    LEMONSQUEEZY_STORE_ID: z.string().min(1).optional(),
    LEMONSQUEEZY_WEBHOOK_SECRET: z.string().min(16).optional(),
    PADDLE_API_KEY: z.string().min(1).optional(),
    PADDLE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    PADDLE_WEBHOOK_SECRET: z.string().min(16).optional(),
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    const secret = v.PAYMENT_PROVIDER === 'lemonsqueezy' ? v.LEMONSQUEEZY_WEBHOOK_SECRET : v.PADDLE_WEBHOOK_SECRET;
    if (!secret) ctx.addIssue({ code: 'custom', path: ['WEBHOOK_SECRET'], message: `missing for ${v.PAYMENT_PROVIDER}` });
  });

export type PaymentEnv = z.infer<typeof paymentEnvSchema>;

export function parsePaymentEnv(source: Record<string, unknown>): PaymentEnv {
  const result = paymentEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return result.data;
}
