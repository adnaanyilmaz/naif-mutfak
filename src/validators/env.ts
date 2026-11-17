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
    ENVIRONMENT: z.enum(['development', 'preview', 'production']),
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

/** Empty strings in `.dev.vars` / dashboard vars mean "unset". */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
}

const emailListSchema = z
  .string()
  .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
  .pipe(z.array(z.email()).min(1));

/** `/admin` auth (admin.md §1). Access is mandatory outside local development. */
export const adminEnvSchema = z
  .object({
    ENVIRONMENT: z.enum(['development', 'preview', 'production']),
    SITE_URL: z.url(),
    ADMIN_EMAILS: emailListSchema,
    CF_ACCESS_TEAM_DOMAIN: optional(z.string().regex(/^[a-z0-9-]+\.cloudflareaccess\.com$/)),
    CF_ACCESS_AUD: optional(z.string().min(16)),
    ADMIN_DEV_EMAIL: optional(z.string().trim().toLowerCase().pipe(z.email())),
  })
  .superRefine((v, ctx) => {
    if (v.ENVIRONMENT === 'production' && v.ADMIN_DEV_EMAIL) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_DEV_EMAIL'], message: 'must not be set in production' });
    }
    if (v.ENVIRONMENT !== 'development' && (!v.CF_ACCESS_TEAM_DOMAIN || !v.CF_ACCESS_AUD)) {
      ctx.addIssue({ code: 'custom', path: ['CF_ACCESS_AUD'], message: 'Cloudflare Access is required outside development' });
    }
  });

export type AdminEnv = z.infer<typeof adminEnvSchema>;

export function parseAdminEnv(source: Record<string, unknown>): AdminEnv {
  const result = adminEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return result.data;
}

/** Presigned R2 uploads (admin.md §3). Without S3 credentials, development falls back to a local PUT route. */
export const uploadEnvSchema = z
  .object({
    ENVIRONMENT: z.enum(['development', 'preview', 'production']),
    SITE_URL: z.url(),
    MEDIA_PUBLIC_URL: z.url(),
    R2_MEDIA_BUCKET: z.string().min(3),
    R2_EBOOKS_BUCKET: z.string().min(3),
    R2_ACCOUNT_ID: optional(z.string().regex(/^[a-f0-9]{32}$/)),
    R2_ACCESS_KEY_ID: optional(z.string().min(16)),
    R2_SECRET_ACCESS_KEY: optional(z.string().min(32)),
  })
  .superRefine((v, ctx) => {
    const configured = Boolean(v.R2_ACCOUNT_ID && v.R2_ACCESS_KEY_ID && v.R2_SECRET_ACCESS_KEY);
    if (v.ENVIRONMENT !== 'development' && !configured) {
      ctx.addIssue({ code: 'custom', path: ['R2_ACCESS_KEY_ID'], message: 'R2 S3 credentials are required outside development' });
    }
  });

export type UploadEnv = z.infer<typeof uploadEnvSchema>;

export function parseUploadEnv(source: Record<string, unknown>): UploadEnv {
  const result = uploadEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return result.data;
}

/** Workers AI model ids for admin auto-translation (vars in wrangler.jsonc). */
const workersAiModel = z.string().regex(/^@(cf|hf)\//);
export const aiEnvSchema = z.object({
  AI_TRANSLATE_MODEL: workersAiModel,
  AI_REVIEW_MODEL: workersAiModel,
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

export function parseAiEnv(source: Record<string, unknown>): AiEnv {
  const result = aiEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return result.data;
}
