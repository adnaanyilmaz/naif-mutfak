import type { HealthRepo } from '@/repositories/health.repo';
import type { AppEnv } from '@/validators/env';

export const EXPECTED_TABLES = 9;

export interface HealthReport {
  ok: boolean;
  environment: AppEnv['ENVIRONMENT'];
  db: { reachable: boolean; tables: number; expected: number };
}

export async function checkHealth(deps: { repo: HealthRepo; env: AppEnv }): Promise<HealthReport> {
  let tables = 0;
  let reachable = false;
  try {
    tables = await deps.repo.countTables();
    reachable = true;
  } catch {
    reachable = false;
  }
  return {
    ok: reachable && tables >= EXPECTED_TABLES,
    environment: deps.env.ENVIRONMENT,
    db: { reachable, tables, expected: EXPECTED_TABLES },
  };
}
