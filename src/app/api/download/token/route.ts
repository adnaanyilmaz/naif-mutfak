import { cookies } from 'next/headers';
import { deliveryDeps } from '@/services/container';
import { issueDownloadToken, ORDER_COOKIE_NAME } from '@/services/payments/delivery.service';

export const dynamic = 'force-dynamic';

/** Exchanges the `nm_ord` checkout cookie for a 15-minute download URL once the order is paid. */
export async function POST(): Promise<Response> {
  const cookie = (await cookies()).get(ORDER_COOKIE_NAME)?.value;
  const result = await issueDownloadToken(deliveryDeps(), cookie);
  const headers = { 'Cache-Control': 'no-store' };
  if (result.status !== 'ok') {
    return Response.json({ ok: false, error: result.status }, { status: result.status === 'unauthorized' ? 401 : 409, headers });
  }
  return Response.json({ ok: true, url: `/api/download/${result.token}` }, { headers });
}
