import { subscribeDeps } from '@/services/container';
import { subscribe } from '@/services/newsletter/subscribe.service';
import { subscribeInputSchema } from '@/validators/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const parsed = subscribeInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'invalid_input', fields: parsed.error.issues.map((i) => i.path.join('.')) }, { status: 400 });
  }
  const { consent: _consent, ...input } = parsed.data;
  // Confirmation email (double opt-in) is sent in a later sprint; the response never reveals whether the address existed.
  await subscribe(subscribeDeps(), input);
  return Response.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
