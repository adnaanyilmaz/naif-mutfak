import { defineConfig } from 'drizzle-kit';

// Generate only. Migrations are applied with `wrangler d1 migrations apply` (local first).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
