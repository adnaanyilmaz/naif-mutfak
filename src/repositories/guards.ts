import { eq, sql } from 'drizzle-orm';
import { posts, products } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';

/**
 * First statement of an optimistic-concurrency batch. D1 has no interactive transactions, so the
 * guard aborts the whole (atomic) batch by raising a SQLite error when the row's `updated_at`
 * moved: `json('conflict')` is malformed JSON → batch rolls back → isGuardViolation(err).
 * The CASE reads the row's own column, so SQLite cannot constant-fold the error away or raise it early.
 * Callers check the row exists beforehand (no row → no guard row → updates affect nothing).
 */
export function guardUpdatedAt(db: Db, table: 'posts' | 'products', id: string, expected: Date) {
  const seconds = Math.floor(expected.getTime() / 1000);
  const t = table === 'posts' ? posts : products;
  return db
    .select({ ok: sql<string>`json(CASE WHEN ${t.updatedAt} = ${seconds} THEN '1' ELSE 'conflict' END)` })
    .from(t)
    .where(eq(t.id, id));
}
