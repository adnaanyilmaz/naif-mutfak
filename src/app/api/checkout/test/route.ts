// Local development only: completes a test checkout through the real (signed) webhook pipeline.
import { cookies } from 'next/headers';
import { testCheckoutDeps } from '@/services/container';
import { ORDER_COOKIE_NAME } from '@/services/payments/delivery.service';
import { completeTestCheckout } from '@/services/payments/test-checkout.service';
import { testCheckoutInputSchema } from '@/validators/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const deps = testCheckoutDeps();
  if (!deps) return new Response(null, { status: 404 });
  if (req.headers.get('origin') !== new URL(req.url).origin) return Response.json({ ok: false, error: 'bad_origin' }, { status: 403 });
  const input = testCheckoutInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const cookie = (await cookies()).get(ORDER_COOKIE_NAME)?.value;
  const result = await completeTestCheckout(deps, cookie, input.data);
  return Response.json(result, { status: result.ok ? 200 : result.error === 'not_found' ? 404 : 409, headers: { 'Cache-Control': 'no-store' } });
}
