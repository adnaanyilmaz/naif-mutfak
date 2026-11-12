import { and, eq, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { orders, subscribers, webhookEvents } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Currency, Locale } from '@/validators/content';
import type { PaymentProviderId } from './products';
import { isUniqueViolation } from './db-errors';
import { toSubscriberRow, type NewSubscriber } from './subscribers';

export { isUniqueViolation } from './db-errors';

export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type WebhookOutcome = 'processed' | 'ignored' | 'failed';

export interface OrderRecord {
  id: string;
  provider: PaymentProviderId;
  providerOrderId: string | null;
  variantId: string;
  customerLocale: Locale;
  status: OrderStatus;
  downloadCount: number;
  maxDownloads: number;
}

export interface PaidValues {
  providerOrderId: string;
  providerCustomerId: string;
  variantId: string;
  email: string;
  currency: Currency | null;
  amountSubtotal: number | null;
  amountTax: number | null;
  amountTotal: number | null;
  eventName: string;
  occurredAt: Date;
}

export interface NewOrder {
  id: string;
  provider: PaymentProviderId;
  customerLocale: Locale;
  variantId: string;
  status: OrderStatus;
  providerOrderId?: string;
  providerCustomerId?: string;
  email?: string;
  currency?: Currency;
  amountSubtotal?: number;
  amountTax?: number;
  amountTotal?: number;
  lastEventName?: string;
  lastEventAt?: Date;
  paidAt?: Date;
  refundedAt?: Date;
}

/** Order write applied atomically with the webhook event row. Guards keep the state machine monotonic. */
export type OrderMutation =
  | { kind: 'insert'; values: NewOrder }
  | { kind: 'markPaid'; orderId: string; values: PaidValues }
  | { kind: 'markRefunded'; orderId: string; eventName: string; occurredAt: Date };

export interface WebhookEventRow {
  provider: PaymentProviderId;
  eventId: string;
  eventName: string;
  orderId: string | null;
  outcome: WebhookOutcome;
  error: string | null;
}

export interface ApplyWebhookInput {
  event: WebhookEventRow;
  order: OrderMutation | null;
  subscriber: NewSubscriber | null;
}

export interface OrdersRepo {
  createPending(values: { id: string; provider: PaymentProviderId; variantId: string; customerLocale: Locale }): Promise<void>;
  findById(id: string): Promise<OrderRecord | null>;
  findByProviderOrderId(provider: PaymentProviderId, providerOrderId: string): Promise<OrderRecord | null>;
  /** One D1 batch (single transaction). Returns 'duplicate' when the event id was already recorded. */
  applyWebhook(input: ApplyWebhookInput): Promise<'applied' | 'duplicate'>;
  /** Atomic entitlement check + counter. Returns the variant id, or null when not entitled. */
  consumeDownload(orderId: string): Promise<string | null>;
}

const recordColumns = {
  id: orders.id,
  provider: orders.provider,
  providerOrderId: orders.providerOrderId,
  variantId: orders.variantId,
  customerLocale: orders.customerLocale,
  status: orders.status,
  downloadCount: orders.downloadCount,
  maxDownloads: orders.maxDownloads,
};

export function createOrdersRepo(db: Db): OrdersRepo {
  function mutationQuery(m: OrderMutation): BatchItem<'sqlite'> {
    switch (m.kind) {
      case 'insert':
        return db.insert(orders).values(m.values);
      case 'markPaid':
        return db
          .update(orders)
          .set({
            status: 'paid',
            providerOrderId: m.values.providerOrderId,
            providerCustomerId: m.values.providerCustomerId,
            variantId: m.values.variantId,
            email: m.values.email,
            currency: m.values.currency,
            amountSubtotal: m.values.amountSubtotal,
            amountTax: m.values.amountTax,
            amountTotal: m.values.amountTotal,
            lastEventName: m.values.eventName,
            lastEventAt: m.values.occurredAt,
            paidAt: m.values.occurredAt,
          })
          .where(and(eq(orders.id, m.orderId), inArray(orders.status, ['pending', 'failed'])));
      case 'markRefunded':
        return db
          .update(orders)
          .set({ status: 'refunded', lastEventName: m.eventName, lastEventAt: m.occurredAt, refundedAt: m.occurredAt })
          .where(and(eq(orders.id, m.orderId), inArray(orders.status, ['pending', 'paid'])));
    }
  }

  async function findOne(where: SQL | undefined): Promise<OrderRecord | null> {
    const rows = await db.select(recordColumns).from(orders).where(where).limit(1);
    return rows[0] ?? null;
  }

  return {
    async createPending(values) {
      await db.insert(orders).values({ ...values, status: 'pending' });
    },

    findById(id) {
      return findOne(eq(orders.id, id));
    },

    findByProviderOrderId(provider, providerOrderId) {
      return findOne(and(eq(orders.provider, provider), eq(orders.providerOrderId, providerOrderId)));
    },

    async applyWebhook({ event, order, subscriber }) {
      // Order write first: webhook_events.order_id references orders.id.
      const eventInsert = db.insert(webhookEvents).values(event);
      const stmts: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = order
        ? [mutationQuery(order), eventInsert]
        : [eventInsert];
      if (subscriber) {
        stmts.push(db.insert(subscribers).values(toSubscriberRow(subscriber)).onConflictDoNothing({ target: subscribers.email }));
      }
      try {
        await db.batch(stmts);
        return 'applied';
      } catch (err) {
        if (isUniqueViolation(err, 'webhook_events')) return 'duplicate';
        throw err;
      }
    },

    async consumeDownload(orderId) {
      const rows = await db
        .update(orders)
        .set({ downloadCount: sql`${orders.downloadCount} + 1` })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'paid'), lt(orders.downloadCount, orders.maxDownloads)))
        .returning({ variantId: orders.variantId });
      return rows[0]?.variantId ?? null;
    },
  };
}
