import { cookies } from 'next/headers';
import { orderStatusDeps } from '@/services/container';
import { ORDER_COOKIE_NAME } from '@/services/payments/delivery.service';
import { getOrderStatus } from '@/services/payments/order-status.service';
import { orderStatusQuerySchema } from '@/validators/api';

export const dynamic = 'force-dynamic';

/** Polled by /{locale}/checkout/success; bound to the browser via the `nm_ord` cookie. */
export async function GET(req: Request): Promise<Response> {
  const query = orderStatusQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!query.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const cookie = (await cookies()).get(ORDER_COOKIE_NAME)?.value;
  const view = await getOrderStatus(orderStatusDeps(), cookie, query.data.locale);
  return Response.json({ ok: true, order: view }, { headers: { 'Cache-Control': 'no-store' } });
}
