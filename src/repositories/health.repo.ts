import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/cloudflare/db';

export interface HealthRepo {
  /** Number of applied migrations-backed tables visible to the binding. */
  countTables(): Promise<number>;
}

export function createHealthRepo(db: Db): HealthRepo {
  return {
    async countTables() {
      const row = await db.get<{ n: number }>(
        sql`SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'`,
      );
      return row.n;
    },
  };
}
