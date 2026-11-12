import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@/db/schema';
import { getBindings } from './env';

export type Db = DrizzleD1Database<typeof schema>;

/** Drizzle client bound to the request's D1 binding. Import only from repositories. */
export function getDb(): Db {
  return drizzle(getBindings().DB, { schema });
}
