// Integration: real D1 (Miniflare/workerd, in-memory). Verifies the settings upsert and its audit row.
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/d1';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import * as schema from '@/db/schema';
import { createSiteSettingsRepo, type SiteSettingsRepo } from './site-settings';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let db: D1Database;
let repo: SiteSettingsRepo;

const audit = { actorEmail: 'chef@naifmutfak.com', action: 'settings.social.update', entityType: 'settings' as const, entityId: 'social', diff: null };

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false, remoteBindings: false });
  db = proxy.env.DB;
  for (const file of ['0000_init.sql', '0004_site_settings.sql']) {
    const sql = readFileSync(new URL(`../../migrations/${file}`, import.meta.url), 'utf8');
    await db.batch(sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  repo = createSiteSettingsRepo(drizzle(db, { schema }));
});

afterAll(async () => {
  await proxy.dispose();
});

describe('SiteSettingsRepo on D1', () => {
  it('returns null for a missing key, then inserts and overwrites it with one audit row per write', async () => {
    expect(await repo.get('social')).toBeNull();

    await repo.set('social', { instagram: 'https://www.instagram.com/a/', youtube: null, tiktok: null }, audit);
    await repo.set('social', { instagram: null, youtube: 'https://www.youtube.com/@b', tiktok: null }, audit);

    expect(await repo.get('social')).toEqual({ instagram: null, youtube: 'https://www.youtube.com/@b', tiktok: null });
    const rows = await db.prepare("SELECT count(*) AS n FROM admin_audit_log WHERE entity_type = 'settings'").first<{ n: number }>();
    expect(rows?.n).toBe(2);
  });
});
