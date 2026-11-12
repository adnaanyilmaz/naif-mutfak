import { eq } from 'drizzle-orm';
import { subscribers } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import type { Locale, Utm } from '@/validators/content';

export type SubscriberSource = 'footer' | 'recipe_card' | 'ebook_callout' | 'popup' | 'checkout';
export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed' | 'bounced';

export interface SubscriberRecord {
  id: string;
  status: SubscriberStatus;
}

export interface NewSubscriber {
  id: string;
  /** Normalized: trimmed + lowercased. */
  email: string;
  locale: Locale;
  source: SubscriberSource;
  confirmTokenHash: string;
  unsubscribeTokenHash: string;
  referrerPath: string | null;
  utm: Utm | null;
  consentAt: Date;
}

export type ResubscribeValues = Pick<
  NewSubscriber,
  'locale' | 'source' | 'confirmTokenHash' | 'unsubscribeTokenHash' | 'consentAt'
>;

export interface SubscribersRepo {
  findByEmail(email: string): Promise<SubscriberRecord | null>;
  /** Insert as `pending`; silently ignores a concurrent duplicate email. */
  insert(values: NewSubscriber): Promise<void>;
  /** Re-subscribe an unsubscribed address: back to pending with fresh tokens (double opt-in again). */
  resetToPending(id: string, values: ResubscribeValues): Promise<void>;
}

/** Row builder shared with the webhook batch (orders repo). */
export function toSubscriberRow(v: NewSubscriber): typeof subscribers.$inferInsert {
  return {
    id: v.id,
    email: v.email,
    locale: v.locale,
    source: v.source,
    status: 'pending',
    confirmTokenHash: v.confirmTokenHash,
    unsubscribeTokenHash: v.unsubscribeTokenHash,
    referrerPath: v.referrerPath,
    utmJson: v.utm,
    consentAt: v.consentAt,
  };
}

export function createSubscribersRepo(db: Db): SubscribersRepo {
  return {
    async findByEmail(email) {
      const rows = await db
        .select({ id: subscribers.id, status: subscribers.status })
        .from(subscribers)
        .where(eq(subscribers.email, email))
        .limit(1);
      return rows[0] ?? null;
    },

    async insert(values) {
      await db.insert(subscribers).values(toSubscriberRow(values)).onConflictDoNothing({ target: subscribers.email });
    },

    async resetToPending(id, values) {
      await db
        .update(subscribers)
        .set({
          status: 'pending',
          locale: values.locale,
          source: values.source,
          confirmTokenHash: values.confirmTokenHash,
          unsubscribeTokenHash: values.unsubscribeTokenHash,
          consentAt: values.consentAt,
          confirmedAt: null,
          unsubscribedAt: null,
        })
        .where(eq(subscribers.id, id));
    },
  };
}
