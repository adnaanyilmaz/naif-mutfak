import { paymentProvider, webhookDeps } from '@/services/container';
import { handleWebhook } from '@/services/payments/webhook.service';

export const dynamic = 'force-dynamic';

/** MoR webhook (provider from PAYMENT_PROVIDER). Raw body is read before any parsing (HMAC over raw bytes). */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const result = await handleWebhook({ provider: paymentProvider(), raw, headers: req.headers, deps: webhookDeps() });
  console.log(JSON.stringify({ msg: 'payment_webhook', status: result.status, ...result.log }));
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}
