import { signToken, verifyToken } from '@/lib/cloudflare/crypto';
import type { PrivateFileStore } from '@/lib/cloudflare/r2';
import type { OrdersRepo } from '@/repositories/orders';
import type { ProductsRepo } from '@/repositories/products';
import { z } from 'zod';

export const DOWNLOAD_TOKEN_TTL_SECONDS = 15 * 60;
export const ORDER_COOKIE_NAME = 'nm_ord';
export const ORDER_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

const orderCookieSchema = z.object({ typ: z.literal('ord'), o: z.uuid(), exp: z.number().int() });
const downloadTokenSchema = z.object({ typ: z.literal('dl'), o: z.uuid(), v: z.uuid(), exp: z.number().int() });

const nowSeconds = (now: Date) => Math.floor(now.getTime() / 1000);

/* ───────────── Checkout cookie (binds the browser that started checkout) ───────────── */

export function mintOrderCookie(secret: string, orderId: string, now: Date): Promise<string> {
  return signToken(secret, { typ: 'ord', o: orderId, exp: nowSeconds(now) + ORDER_COOKIE_MAX_AGE_SECONDS });
}

export async function readOrderCookie(secret: string, value: string, now: Date): Promise<string | null> {
  const parsed = orderCookieSchema.safeParse(await verifyToken(secret, value));
  if (!parsed.success || parsed.data.exp <= nowSeconds(now)) return null;
  return parsed.data.o;
}

/* ───────────── Download tokens ───────────── */

export function mintDownloadToken(args: {
  secret: string;
  orderId: string;
  variantId: string;
  now: Date;
  ttlSeconds?: number;
}): Promise<string> {
  const exp = nowSeconds(args.now) + (args.ttlSeconds ?? DOWNLOAD_TOKEN_TTL_SECONDS);
  return signToken(args.secret, { typ: 'dl', o: args.orderId, v: args.variantId, exp });
}

export type DownloadTokenCheck =
  | { valid: true; orderId: string; variantId: string }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'wrong_type' | 'expired' };

/** Signature (crypto.subtle.verify) → shape (Zod) → `typ === 'dl'` → expiry. */
export async function verifyDownloadToken(secret: string, token: string, now: Date): Promise<DownloadTokenCheck> {
  if (token.length === 0 || token.length > 1024) return { valid: false, reason: 'malformed' };
  const payload = await verifyToken(secret, token);
  if (payload === null) return { valid: false, reason: 'bad_signature' };
  const parsed = downloadTokenSchema.safeParse(payload);
  if (!parsed.success) return { valid: false, reason: 'wrong_type' };
  if (parsed.data.exp <= nowSeconds(now)) return { valid: false, reason: 'expired' };
  return { valid: true, orderId: parsed.data.o, variantId: parsed.data.v };
}

export interface IssueDeps {
  orders: OrdersRepo;
  secret: string;
  now: () => Date;
}

/** Exchanges a valid `nm_ord` cookie for a short-lived download token once the order is paid. */
export async function issueDownloadToken(
  deps: IssueDeps,
  orderCookie: string | undefined,
): Promise<{ status: 'ok'; token: string } | { status: 'unauthorized' | 'not_paid' }> {
  const now = deps.now();
  const orderId = orderCookie ? await readOrderCookie(deps.secret, orderCookie, now) : null;
  if (!orderId) return { status: 'unauthorized' };
  const order = await deps.orders.findById(orderId);
  if (!order || order.status !== 'paid') return { status: 'not_paid' };
  return { status: 'ok', token: await mintDownloadToken({ secret: deps.secret, orderId, variantId: order.variantId, now }) };
}

export interface RedeemDeps extends IssueDeps {
  products: ProductsRepo;
  store: PrivateFileStore;
  /** DOWNLOAD_LIMITER keyed on the order id (payments.md §4). Optional so tests can omit it. */
  limiter?: { allow(key: string): Promise<boolean> };
}

export type RedeemResult =
  | { status: 200; body: ReadableStream; size: number; filename: string }
  | { status: 401 | 403 | 404 | 429; error: string };

/** Token check → atomic entitlement + counter (refunds revoke instantly) → stream from private R2. */
export async function redeemDownloadToken(deps: RedeemDeps, token: string): Promise<RedeemResult> {
  const check = await verifyDownloadToken(deps.secret, token, deps.now());
  if (!check.valid) return { status: 401, error: check.reason };
  if (deps.limiter && !(await deps.limiter.allow(check.orderId))) return { status: 429, error: 'rate_limited' };

  const variantId = await deps.orders.consumeDownload(check.orderId);
  if (!variantId) return { status: 403, error: 'not_entitled' };

  const file = await deps.products.findVariantFile(variantId);
  if (!file?.pdfR2Key) return { status: 404, error: 'file_missing' };
  const obj = await deps.store.get(file.pdfR2Key);
  if (!obj) return { status: 404, error: 'file_missing' };

  return { status: 200, body: obj.body, size: obj.size, filename: `${file.productSlug}-${file.contentLocale}.pdf` };
}
