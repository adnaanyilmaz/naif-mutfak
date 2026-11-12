import { describe, expect, it } from 'vitest';
import { checkHealth, EXPECTED_TABLES } from './health.service';
import type { AppEnv } from '@/validators/env';

const env: AppEnv = {
  ENVIRONMENT: 'development',
  SITE_URL: 'http://localhost:3000',
  MEDIA_PUBLIC_URL: 'http://localhost:3000/media',
  PAYMENT_PROVIDER: 'lemonsqueezy',
};

describe('checkHealth', () => {
  it('is ok when all tables exist', async () => {
    const report = await checkHealth({ env, repo: { countTables: async () => EXPECTED_TABLES } });
    expect(report.ok).toBe(true);
    expect(report.db).toEqual({ reachable: true, tables: EXPECTED_TABLES, expected: EXPECTED_TABLES });
  });

  it('is not ok when migrations are missing', async () => {
    const report = await checkHealth({ env, repo: { countTables: async () => 0 } });
    expect(report.ok).toBe(false);
  });

  it('reports unreachable when the query throws', async () => {
    const report = await checkHealth({
      env,
      repo: {
        countTables: async () => {
          throw new Error('D1 down');
        },
      },
    });
    expect(report).toMatchObject({ ok: false, db: { reachable: false } });
  });
});
