import { checkoutDeps, requestClientKey } from '@/services/container';
import { startCheckout } from '@/services/payments/checkout.service';
import { ORDER_COOKIE_MAX_AGE_SECONDS, ORDER_COOKIE_NAME } from '@/services/payments/delivery.service';
import { checkoutInputSchema } from '@/validators/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const parsed = checkoutInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });

  const result = await startCheckout(checkoutDeps(), parsed.data, { clientKey: await requestClientKey(req.headers) });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  const cookie = `${ORDER_COOKIE_NAME}=${result.orderCookie}; Path=/; Max-Age=${ORDER_COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
  return Response.json({ ok: true, checkout: result.params }, { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
}
