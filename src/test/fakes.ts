// In-memory repository fakes for service tests. Mirror the D1 semantics the services rely on
// (UNIQUE(provider, event_id) → whole batch rejected; monotonic WHERE guards on order updates).
import type { OrderRecord, OrdersRepo, WebhookEventRow } from '@/repositories/orders';
import type { ProductsRepo, VariantFile, VariantRecord } from '@/repositories/products';
import type { NewSubscriber, SubscriberRecord, SubscribersRepo } from '@/repositories/subscribers';

export type StoredOrder = OrderRecord & { [key: string]: unknown };

export function createFakeOrdersRepo(initial: StoredOrder[] = []) {
  const orders = new Map(initial.map((o) => [o.id, { ...o }]));
  const events: WebhookEventRow[] = [];
  const subscribers: NewSubscriber[] = [];

  const repo: OrdersRepo = {
    async createPending(v) {
      orders.set(v.id, { ...v, status: 'pending', providerOrderId: null, downloadCount: 0, maxDownloads: 10 });
    },
    async findById(id) {
      return orders.get(id) ?? null;
    },
    async findByProviderOrderId(provider, providerOrderId) {
      return [...orders.values()].find((o) => o.provider === provider && o.providerOrderId === providerOrderId) ?? null;
    },
    async applyWebhook({ event, order, subscriber }) {
      if (events.some((e) => e.provider === event.provider && e.eventId === event.eventId)) return 'duplicate';
      if (order?.kind === 'insert') {
        const { providerOrderId = null, ...rest } = order.values;
        orders.set(order.values.id, { ...rest, providerOrderId, downloadCount: 0, maxDownloads: 10 });
      } else if (order?.kind === 'markPaid') {
        const o = orders.get(order.orderId);
        if (o && (o.status === 'pending' || o.status === 'failed')) {
          const { eventName: _e, occurredAt, ...v } = order.values;
          orders.set(o.id, { ...o, ...v, status: 'paid', paidAt: occurredAt });
        }
      } else if (order?.kind === 'markRefunded') {
        const o = orders.get(order.orderId);
        if (o && (o.status === 'pending' || o.status === 'paid')) orders.set(o.id, { ...o, status: 'refunded', refundedAt: order.occurredAt });
      }
      events.push(event);
      if (subscriber && !subscribers.some((s) => s.email === subscriber.email)) subscribers.push(subscriber);
      return 'applied';
    },
    async consumeDownload(orderId) {
      const o = orders.get(orderId);
      if (!o || o.status !== 'paid' || o.downloadCount >= o.maxDownloads) return null;
      o.downloadCount += 1;
      return o.variantId;
    },
  };
  return { repo, orders, events, subscribers };
}

export const VARIANT_TR = '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b11';
export const VARIANT_EN = '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b12';

export const sampleVariants: VariantRecord[] = [
  {
    id: VARIANT_TR,
    productId: 'p1',
    contentLocale: 'tr',
    sku: 'EBOOK-TR',
    priceTry: 34900,
    priceUsd: 1200,
    priceSar: 4500,
    lsVariantId: '100001',
    paddlePriceId: 'pri_tr',
    isActive: true,
  },
  {
    id: VARIANT_EN,
    productId: 'p1',
    contentLocale: 'en',
    sku: 'EBOOK-EN',
    priceTry: 34900,
    priceUsd: 1200,
    priceSar: 4500,
    lsVariantId: '100002',
    paddlePriceId: 'pri_en',
    isActive: true,
  },
];

export function createFakeProductsRepo(files: Record<string, string | null> = {}): ProductsRepo {
  return {
    async listActive() {
      return [];
    },
    async findActiveBySlugs() {
      return [];
    },
    async findVariantForCheckout(id) {
      const v = sampleVariants.find((x) => x.id === id);
      return v ? { ...v, productStatus: 'active' } : null;
    },
    async findVariantIdByProviderRef(provider, ref) {
      return sampleVariants.find((v) => (provider === 'lemonsqueezy' ? v.lsVariantId : v.paddlePriceId) === ref)?.id ?? null;
    },
    async findVariantFile(variantId): Promise<VariantFile | null> {
      const v = sampleVariants.find((x) => x.id === variantId);
      if (!v) return null;
      return { variantId, pdfR2Key: variantId in files ? (files[variantId] ?? null) : `ebooks/p1/${variantId}.pdf`, productSlug: 'baking-at-home', contentLocale: v.contentLocale };
    },
  };
}

export function createFakeSubscribersRepo(initial: (SubscriberRecord & { email: string })[] = []) {
  const rows = [...initial];
  const resets: string[] = [];
  const repo: SubscribersRepo = {
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async insert(v) {
      if (!rows.some((r) => r.email === v.email)) rows.push({ id: v.id, email: v.email, status: 'pending' });
    },
    async resetToPending(id) {
      const r = rows.find((x) => x.id === id);
      if (r) r.status = 'pending';
      resets.push(id);
    },
  };
  return { repo, rows, resets };
}

let counter = 0;
/** Deterministic UUID v4-shaped ids. */
export function fakeId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}
