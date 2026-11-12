import { deliveryDeps } from '@/services/container';
import { redeemDownloadToken } from '@/services/payments/delivery.service';
import { downloadTokenParamSchema } from '@/validators/api';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
};

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const token = downloadTokenParamSchema.safeParse((await params).token);
  if (!token.success) return Response.json({ ok: false, error: 'malformed' }, { status: 401, headers: PRIVATE_HEADERS });

  const result = await redeemDownloadToken(deliveryDeps(), token.data);
  if (result.status !== 200) {
    return Response.json({ ok: false, error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
  }
  return new Response(result.body, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Length': String(result.size),
      'Content-Disposition': `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    },
  });
}
