// Composition root: binds request-scoped Cloudflare bindings to repositories and services.
// `app/` imports deps from here; business services stay pure and receive deps as arguments.
import { getDb } from '@/lib/cloudflare/db';
import { getEnv, getPaymentEnv } from '@/lib/cloudflare/env';
import { getPrivateEbookStore } from '@/lib/cloudflare/r2';
import { createOrdersRepo } from '@/repositories/orders';
import { createPostsRepo } from '@/repositories/posts';
import { createProductsRepo } from '@/repositories/products';
import { createSubscribersRepo } from '@/repositories/subscribers';
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
