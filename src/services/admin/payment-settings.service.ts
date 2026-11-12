// Read-only payment setup overview for /admin/payments. Reports whether secrets are set, never their values.
import type { AdminProductListItem } from '@/repositories/admin-products';
import type { Locale } from '@/validators/content';

export type ProviderId = 'lemonsqueezy' | 'paddle';
export type CheckKey = 'webhookSecret' | 'apiKey' | 'storeId' | 'clientToken' | 'downloadSecret';

export interface PaymentSettingsDeps {
  provider: ProviderId;
  environment: 'development' | 'preview' | 'production';
  paddleEnv: 'sandbox' | 'production';
  siteUrl: string;
  testCheckout: boolean;
  /** Presence of a named var/secret. */
  isConfigured: (name: string) => boolean;
  listProducts: () => Promise<AdminProductListItem[]>;
  webhookOutcomes: (since: Date) => Promise<{ outcome: string; count: number }[]>;
  now: () => Date;
}

export interface PaymentSettingsView {
  provider: ProviderId;
  mode: 'test' | 'sandbox' | 'live';
  checks: { key: CheckKey; env: string; ok: boolean }[];
  ready: boolean;
  webhookUrl: string;
  events: string[];
  missingIds: { productId: string; title: string; locale: Locale }[];
  outcomes: { outcome: string; count: number }[];
  testCheckout: boolean;
}

const REQUIRED: Record<ProviderId, { key: CheckKey; env: string }[]> = {
  lemonsqueezy: [
    { key: 'webhookSecret', env: 'LEMONSQUEEZY_WEBHOOK_SECRET' },
    { key: 'apiKey', env: 'LEMONSQUEEZY_API_KEY' },
    { key: 'storeId', env: 'LEMONSQUEEZY_STORE_ID' },
    { key: 'downloadSecret', env: 'DOWNLOAD_SIGNING_SECRET' },
  ],
  paddle: [
    { key: 'webhookSecret', env: 'PADDLE_WEBHOOK_SECRET' },
    { key: 'apiKey', env: 'PADDLE_API_KEY' },
    { key: 'clientToken', env: 'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN' },
    { key: 'downloadSecret', env: 'DOWNLOAD_SIGNING_SECRET' },
  ],
};

/** Events the webhook handler understands (payments.md §3). */
export const PROVIDER_EVENTS: Record<ProviderId, string[]> = {
  lemonsqueezy: ['order_created', 'order_refunded'],
  paddle: ['transaction.completed', 'adjustment.created', 'adjustment.updated'],
};

export async function getPaymentSettings(deps: PaymentSettingsDeps): Promise<PaymentSettingsView> {
  const weekAgo = new Date(deps.now().getTime() - 7 * 86_400_000);
  const [products, outcomes] = await Promise.all([deps.listProducts(), deps.webhookOutcomes(weekAgo)]);
  const checks = REQUIRED[deps.provider].map((c) => ({ ...c, ok: deps.isConfigured(c.env) }));
  const idOf = (v: AdminProductListItem['variants'][number]) => (deps.provider === 'lemonsqueezy' ? v.lsVariantId : v.paddlePriceId);
  const missingIds = products.flatMap((p) =>
    p.variants
      .filter((v) => !idOf(v))
      .map((v) => ({
        productId: p.id,
        title: p.titles.find((t) => t.locale === 'tr')?.title ?? p.titles[0]?.title ?? p.slug,
        locale: v.contentLocale,
      })),
  );
  const mode = deps.testCheckout ? 'test' : deps.provider === 'paddle' && deps.paddleEnv === 'sandbox' ? 'sandbox' : 'live';
  return {
    provider: deps.provider,
    mode,
    checks,
    ready: checks.every((c) => c.ok),
    webhookUrl: `${deps.siteUrl.replace(/\/+$/, '')}/api/webhooks/payment`,
    events: PROVIDER_EVENTS[deps.provider],
    missingIds,
    outcomes,
    testCheckout: deps.testCheckout,
  };
}
