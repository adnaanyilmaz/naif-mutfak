import { guardAdminDownload } from '@/app/admin/_server/api-guard';
import { orderFilters, ordersCsvStream, resolveRange } from '@/services/admin/analytics.service';
import { analyticsDeps } from '@/services/container';
import { exportQuerySchema, salesQuerySchema } from '@/validators/admin/analytics';

export async function GET(req: Request): Promise<Response> {
  const guard = await guardAdminDownload(req);
  if (!guard.ok) return guard.response;
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = salesQuerySchema.safeParse(params);
  const flags = exportQuerySchema.safeParse(params);
  if (!query.success || !flags.success) return Response.json({ error: 'invalid' }, { status: 400 });

  const deps = analyticsDeps();
  const resolved = resolveRange(query.data, deps.now());
  if (typeof resolved === 'string') return Response.json({ error: resolved }, { status: 400 });

  const stream = ordersCsvStream(deps, guard.admin, orderFilters(query.data, resolved.range), flags.data.unmasked === '1');
  return new Response(stream, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="orders-${resolved.from}-${resolved.to}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
}
