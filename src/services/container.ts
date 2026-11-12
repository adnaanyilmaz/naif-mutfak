// Composition root: binds request-scoped Cloudflare bindings to repositories and services.
// `app/` imports deps from here; business services stay pure and receive deps as arguments.
import { accessJwks } from '@/lib/cloudflare/access-jwks';
import { getDb } from '@/lib/cloudflare/db';
import { getAdminEnv, getEnv, getPaymentEnv, getUploadEnv, waitUntil } from '@/lib/cloudflare/env';
import { getPrivateEbookStore, getPublicMediaObject, getUploadStores } from '@/lib/cloudflare/r2';
import { createDevSigner, createR2Signer } from '@/lib/cloudflare/r2-presign';
import { createAdminPostsRepo } from '@/repositories/admin-posts';
import { createAdminProductsRepo } from '@/repositories/admin-products';
import { createAnalyticsRepo } from '@/repositories/analytics.repo';
import { createAuditRepo } from '@/repositories/audit';
import { createOrdersRepo } from '@/repositories/orders';
import { createPostsRepo } from '@/repositories/posts';
import { createProductsRepo } from '@/repositories/products';
import { createSubscribersRepo } from '@/repositories/subscribers';
import type { AdminAuthDeps } from './admin/auth.service';
import type { AnalyticsDeps } from './admin/analytics.service';
import type { AdminPostsDeps } from './admin/posts-admin.service';
import type { AdminProductsDeps } from './admin/products-admin.service';
import type { UploadDeps } from './admin/upload.service';
import type { DevMediaDeps } from './media/dev-media.service';
import type { ContentDeps } from './content/posts.service';
import type { SubscribeDeps } from './newsletter/subscribe.service';
import type { CheckoutDeps } from './payments/checkout.service';
import type { RedeemDeps } from './payments/delivery.service';
import { createLemonSqueezyProvider } from './payments/lemonsqueezy';
import { createPaddleProvider } from './payments/paddle';
import type { PaymentProvider } from './payments/provider';
import type { WebhookDeps } from './payments/webhook.service';

const now = () => new Date();
const newId = () => crypto.randomUUID();

export function contentDeps(): ContentDeps {
  const db = getDb();
  const env = getEnv();
  return {
    posts: createPostsRepo(db),
    products: createProductsRepo(db),
    siteUrl: env.SITE_URL,
    mediaBaseUrl: env.MEDIA_PUBLIC_URL,
  };
}

export function subscribeDeps(): SubscribeDeps {
  return { subscribers: createSubscribersRepo(getDb()), now, newId };
}

export function paymentProvider(): PaymentProvider {
  const env = getPaymentEnv();
  if (env.PAYMENT_PROVIDER === 'lemonsqueezy') {
    return createLemonSqueezyProvider({
      webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '',
      apiKey: env.LEMONSQUEEZY_API_KEY,
      storeId: env.LEMONSQUEEZY_STORE_ID,
    });
  }
  return createPaddleProvider({
    webhookSecret: env.PADDLE_WEBHOOK_SECRET ?? '',
    apiKey: env.PADDLE_API_KEY,
    clientToken: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    environment: env.PADDLE_ENV,
  });
}

export function webhookDeps(): WebhookDeps {
  const db = getDb();
  return { orders: createOrdersRepo(db), products: createProductsRepo(db), now, newId };
}

export function checkoutDeps(): CheckoutDeps {
  const db = getDb();
  const env = getPaymentEnv();
  return {
    orders: createOrdersRepo(db),
    products: createProductsRepo(db),
    provider: paymentProvider(),
    secret: env.DOWNLOAD_SIGNING_SECRET,
    siteUrl: env.SITE_URL,
    now,
    newId,
  };
}

export function deliveryDeps(): RedeemDeps {
  const db = getDb();
  return {
    orders: createOrdersRepo(db),
    products: createProductsRepo(db),
    store: getPrivateEbookStore(),
    secret: getPaymentEnv().DOWNLOAD_SIGNING_SECRET,
    now,
  };
}

/* ───────────── Admin ───────────── */

export function adminAuthDeps(): AdminAuthDeps {
  const env = getAdminEnv();
  return {
    config: {
      environment: env.ENVIRONMENT,
      teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
      audience: env.CF_ACCESS_AUD,
      adminEmails: env.ADMIN_EMAILS,
      devEmail: env.ADMIN_DEV_EMAIL,
    },
    getKey: accessJwks,
  };
}

export function adminPostsDeps(): AdminPostsDeps {
  const env = getEnv();
  return { posts: createAdminPostsRepo(getDb()), siteUrl: env.SITE_URL, mediaBaseUrl: env.MEDIA_PUBLIC_URL, now, newId };
}

export function adminProductsDeps(): AdminProductsDeps {
  const env = getEnv();
  return {
    products: createAdminProductsRepo(getDb()),
    provider: env.PAYMENT_PROVIDER,
    mediaBaseUrl: env.MEDIA_PUBLIC_URL,
    now,
    newId,
  };
}

export function uploadDeps(): UploadDeps {
  const db = getDb();
  const env = getUploadEnv();
  const signer =
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
      ? createR2Signer({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucketNames: { media: env.R2_MEDIA_BUCKET, ebooks: env.R2_EBOOKS_BUCKET },
          ttlSeconds: 300,
        })
      : createDevSigner(env.SITE_URL);
  return {
    stores: getUploadStores(),
    signer,
    posts: createAdminPostsRepo(db),
    products: createAdminProductsRepo(db),
    audit: createAuditRepo(db),
    mediaBaseUrl: env.MEDIA_PUBLIC_URL,
    newId,
    defer: waitUntil,
  };
}

/** Local PUT fallback is allowed only in development without S3 credentials. */
export function devUploadsEnabled(): boolean {
  const env = getUploadEnv();
  return env.ENVIRONMENT === 'development' && !(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

export function analyticsDeps(): AnalyticsDeps {
  const db = getDb();
  return { analytics: createAnalyticsRepo(db), audit: createAuditRepo(db), now };
}

export function devMediaDeps(): DevMediaDeps {
  return { environment: getEnv().ENVIRONMENT, getObject: getPublicMediaObject };
}

export function devUploadStores(): UploadDeps['stores'] {
  return getUploadStores();
}
