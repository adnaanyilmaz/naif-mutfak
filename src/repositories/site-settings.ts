import { eq } from 'drizzle-orm';
import { siteSettings } from '@/db/schema';
import type { Db } from '@/lib/cloudflare/db';
import { auditInsert, type AuditEntry } from './audit';

export type SiteSettingKey = 'social';

export interface SiteSettingsRepo {
  /** Raw stored JSON; callers validate it for their key. */
  get(key: SiteSettingKey): Promise<unknown>;
  set(key: SiteSettingKey, value: Record<string, unknown>, audit: AuditEntry): Promise<void>;
}

export function createSiteSettingsRepo(db: Db): SiteSettingsRepo {
  return {
    async get(key) {
      const [row] = await db.select({ value: siteSettings.valueJson }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
      return row?.value ?? null;
    },

    async set(key, value, audit) {
      await db.batch([
        db
          .insert(siteSettings)
          .values({ key, valueJson: value })
          .onConflictDoUpdate({ target: siteSettings.key, set: { valueJson: value, updatedAt: new Date() } }),
        auditInsert(db, audit),
      ]);
    },
  };
}
