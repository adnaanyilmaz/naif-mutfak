import { getDb } from '@/lib/cloudflare/db';
import { getEnv } from '@/lib/cloudflare/env';
import { createHealthRepo } from '@/repositories/health.repo';
import { checkHealth } from '@/services/health.service';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const report = await checkHealth({ repo: createHealthRepo(getDb()), env: getEnv() });
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
