import type { Db } from '@/lib/cloudflare/db';
import { adminAuditLog } from '@/db/schema';

export interface AuditEntry {
  actorEmail: string;
  action: string;
  entityType: 'post' | 'product' | 'variant' | 'upload' | 'order' | 'export';
  entityId: string;
  /** Minimal diff: changed field names / ids only, never full bodies or PII. */
  diff: Record<string, unknown> | null;
}

/** Audit insert to include in the same `db.batch` as the mutation it records. */
export function auditInsert(db: Db, entry: AuditEntry) {
  return db.insert(adminAuditLog).values({
    actorEmail: entry.actorEmail,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    diffJson: entry.diff,
  });
}

export interface AuditRepo {
  /** Standalone audit write (reads with side effects: reveal email, unmasked export). */
  record(entry: AuditEntry): Promise<void>;
}

export function createAuditRepo(db: Db): AuditRepo {
  return {
    async record(entry) {
      await auditInsert(db, entry);
    },
  };
}
