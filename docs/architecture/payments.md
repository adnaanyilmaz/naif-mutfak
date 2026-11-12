# Payments Architecture — MoR Checkout, Webhooks, PDF Delivery

Merchant of Record: **Lemon Squeezy** or **Paddle Billing**, selected by `PAYMENT_PROVIDER` (`lemonsqueezy` | `paddle`). Both are implemented behind one interface so the storefront never branches on provider.

```
src/services/payments/
  provider.ts            # interface PaymentProvider { createCheckout, verifyWebhook, parseEvent }
  lemonsqueezy.ts        # implements PaymentProvider
  paddle.ts              # implements PaymentProvider
  checkout.service.ts    # startCheckout(): creates pending order, returns overlay params
  webhook.service.ts     # handleWebhook(): verify → parse → idempotent apply
  delivery.service.ts    # mintDownloadToken(), redeemDownloadToken()
src/validators/webhooks/{lemonsqueezy,paddle}.ts   # Zod payload schemas (only fields we use, .passthrough() off)
src/lib/cloudflare/crypto.ts                        # hmacVerifyHex(), sha256Hex(), signToken(), verifyToken()
```

## Environment (validated in `validators/env.ts`)

| Var | Kind | Purpose |
|---|---|---|
| `PAYMENT_PROVIDER` | var | `lemonsqueezy` \| `paddle` |
| `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID` | secret / var | Create checkouts (server-side) |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | secret | HMAC key for `X-Signature` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_ENV` | var | Paddle.js init (`sandbox` \| `production`) |
| `PADDLE_API_KEY` | secret | Fetch customer email on `transaction.completed` |
| `PADDLE_WEBHOOK_SECRET` | secret | HMAC key for `Paddle-Signature` |
| `DOWNLOAD_SIGNING_SECRET` | secret | HMAC key for checkout cookie + download tokens (≥ 32 random bytes) |

## End-to-End Sequence

```mermaid
sequenceDiagram
  autonumber
  actor U as Buyer (browser)
  participant W as Next.js on Workers
  participant D as D1
  participant M as MoR (LS / Paddle)
  participant R as R2 EBOOKS_PRIVATE
  participant E as Email

  U->>W: POST /api/checkout {variantId, locale}
  W->>W: Zod validate, rate limit, load active variant
  W->>D: INSERT orders(id=order_ref, status=pending, variant_id, provider, locale)
  alt Lemon Squeezy
    W->>M: POST /v1/checkouts (custom.order_ref, embed=true, variant)
    M-->>W: checkout URL
    W-->>U: {provider:'lemonsqueezy', url} + Set-Cookie nm_ord (signed order_ref)
    U->>M: LemonSqueezy.Url.Open(url)  [overlay]
  else Paddle
    W-->>U: {provider:'paddle', priceId, customData:{order_ref}} + Set-Cookie nm_ord
    U->>M: Paddle.Checkout.open({items, customData, settings:{displayMode:'overlay', locale}})
  end
  U->>M: Pays (card / wallet / local methods; MoR handles tax)
  M-->>U: Overlay success event → client routes to /{locale}/checkout/success
  M->>W: POST /api/webhooks/{provider} (raw body + signature header)
  W->>W: crypto.subtle.verify(HMAC-SHA256) on raw bytes → 401 if invalid
  W->>W: JSON.parse → Zod → normalized OrderEvent
  W->>D: db.batch([INSERT webhook_events, UPSERT orders → paid])  (atomic)
  alt Duplicate event (UNIQUE provider,event_id)
    D-->>W: constraint error → batch rolled back
    W-->>M: 200 {duplicate:true}
  else New event
    W-->>M: 200
    W-)E: ctx.waitUntil(send receipt with 72h library link)
  end
  loop until paid (max ~30s, backoff)
    U->>W: GET /api/orders/status (cookie nm_ord)
    W->>D: SELECT status FROM orders WHERE id = order_ref
    W-->>U: {status}
  end
  U->>W: POST /api/downloads/token (cookie nm_ord)
  W->>W: mint dl token {o, v, exp=now+15m} signed HMAC
  W-->>U: /api/downloads/{token}
  U->>W: GET /api/downloads/{token}
  W->>W: verify token sig + exp
  W->>D: UPDATE orders SET download_count+1 WHERE id=? AND status='paid' AND download_count<max_downloads RETURNING variant_id
  W->>R: EBOOKS_PRIVATE.get(pdf_r2_key)
  R-->>W: ReadableStream
  W-->>U: 200 application/pdf (Content-Disposition: attachment, Cache-Control: private, no-store)
```

## 1. Checkout Initiation — `POST /api/checkout`

- Input (Zod): `{ variantId: uuid, locale: z.enum(LOCALES) }`. Never accept price, currency, or email from the client.
- Service loads the variant; rejects if `!isActive`, product not `active`, or provider ID missing.
- Creates `orders` row: `id = crypto.randomUUID()` (the **order_ref**), `status='pending'`.
- Sets cookie `nm_ord = order_ref.<hmac>`: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`. This binds the browser that started checkout to the success-page download flow.
- Rate limited via Workers Rate Limiting binding (`CHECKOUT_LIMITER`, key = client IP hash).
- Provider specifics:
  - **Lemon Squeezy:** server `POST https://api.lemonsqueezy.com/v1/checkouts` with `checkout_data.custom.order_ref`, `checkout_options.embed=true`, `product_options.redirect_url=/{locale}/checkout/success`. Client opens with `lemon.js` → `LemonSqueezy.Url.Open(url)`.
  - **Paddle:** no server call needed. Client calls `Paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customData: { order_ref }, settings: { displayMode: 'overlay', locale } })`. Paddle.js is loaded only on pages with a buy CTA.
- Pending orders older than 48h are purged by a Cron Trigger (`status='pending' AND provider_order_id IS NULL`).

## 2. Webhook Verification (Web Crypto only)

| Provider | Header | Signed message | Algorithm |
|---|---|---|---|
| Lemon Squeezy | `X-Signature: <hex>` | raw body | HMAC-SHA256, hex |
| Paddle | `Paddle-Signature: ts=<unix>;h1=<hex>` | `` `${ts}:${rawBody}` `` | HMAC-SHA256, hex; reject if `|now - ts| > 300s` |

`crypto.subtle.verify` performs a constant-time comparison — never compare hex strings with `===`.

```ts
// src/lib/cloudflare/crypto.ts
const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hmacVerifyHex(secret: string, message: string, signatureHex: string): Promise<boolean> {
  const sig = hexToBytes(signatureHex);
  if (!sig) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(message));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

Route handler contract (`src/app/api/webhooks/[provider]/route.ts`):

```ts
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = providerParamSchema.parse((await params).provider);
  const raw = await req.text();                            // raw body BEFORE any parsing
  const result = await handleWebhook({ provider, raw, headers: req.headers, deps: await getDeps() });
  return Response.json(result.body, { status: result.status });
}
```

## 3. Event Normalization & Idempotent Recording

Provider payloads are Zod-parsed then mapped to one internal type:

```ts
type OrderEvent =
  | { kind: 'paid'; eventId: string; orderRef: string | null; providerOrderId: string; providerCustomerId: string;
      providerVariantId: string; email: string; currency: Currency; subtotal: number; tax: number; total: number; occurredAt: Date }
  | { kind: 'refunded'; eventId: string; providerOrderId: string; occurredAt: Date }
  | { kind: 'ignored'; eventId: string; eventName: string };
```

| Provider | `paid` | `refunded` | `eventId` |
|---|---|---|---|
| Lemon Squeezy | `order_created` with `data.attributes.status = 'paid'`; `meta.custom_data.order_ref` | `order_refunded` | SHA-256 hex of raw body (LS sends no event id) |
| Paddle | `transaction.completed`; `data.custom_data.order_ref`; email fetched via `GET /customers/{customer_id}` | `adjustment.created`/`adjustment.updated` with `action='refund'` and `status='approved'` | `event_id` |

Apply rules (`webhook.service.ts`):

1. **Single atomic batch** (D1 batches run in one transaction): `INSERT webhook_events` (no `ON CONFLICT`) + order mutation. A duplicate event violates `UNIQUE(provider, event_id)`, the whole batch rolls back, and the service returns `200 {duplicate:true}`. This guarantees an event is never marked processed without its order write, and vice versa.
2. **Order matching:** by `order_ref` (custom data) → else by `(provider, provider_order_id)`. Custom data is client-influenced and therefore untrusted: the provider variant/price in the payload must map to the pending order's `variant_id`. On mismatch, the order is recorded from provider data (the payment is real) and the event is logged `outcome='failed'` with `error='variant_mismatch'` for manual review.
3. **Monotonic state machine:** `pending → paid → refunded`; `failed` only from `pending`. Never move backwards. If a refund arrives before the paid event, create the row as `refunded` from the refund data; the later paid event becomes a no-op.
4. **Amounts** are stored exactly as reported by the MoR (minor units, string → int via Zod `z.coerce.number().int()`).
5. **Response codes:** `401` invalid signature/stale timestamp · `400` schema failure (logged, not retried usefully) · `200` processed/ignored/duplicate · `500` only for transient infrastructure errors so the MoR retries.
6. **Side effects** (receipt email, analytics) run in `ctx.waitUntil()` after the batch commits; failures there never affect the webhook response.

## 4. PDF Delivery

Primary: **Worker stream** from the private R2 binding (no public URL ever exists). Fallback for very large files only: S3-API presigned GET (`aws4fetch`, TTL ≤ 5 min) issued under the same entitlement checks.

**Token format** (`signToken` / `verifyToken`): `base64url(JSON payload) + '.' + base64url(HMAC-SHA256(DOWNLOAD_SIGNING_SECRET, payload))`.

| Token `typ` | Payload | TTL | Issued by |
|---|---|---|---|
| `ord` (cookie) | `{ typ, o }` | 24 h | `POST /api/checkout` |
| `lib` (email link) | `{ typ, o, exp }` | 72 h | Receipt email → `/{locale}/library/{token}` page |
| `dl` | `{ typ, o, v, exp }` | 15 min | `POST /api/downloads/token` (requires valid `ord` cookie or `lib` token) |

`GET /api/downloads/{token}` (`delivery.service.ts`):

1. Verify signature (`crypto.subtle.verify`) and `exp`; `typ` must be `dl`.
2. Atomic entitlement + counter in one statement:
   `UPDATE orders SET download_count = download_count + 1 WHERE id = ? AND status = 'paid' AND download_count < max_downloads RETURNING variant_id` → no row = 403 (refunded, unpaid, or limit reached).
3. Load `pdf_r2_key` for `v`; `EBOOKS_PRIVATE.get(key)` → 404 if missing (alert).
4. Respond with `obj.body` stream and headers:
   `Content-Type: application/pdf` · `Content-Disposition: attachment; filename*=UTF-8''<localized-title>.pdf` · `Content-Length` · `Cache-Control: private, no-store` · `X-Robots-Tag: noindex` · `Referrer-Policy: no-referrer`.
5. Rate limited (`DOWNLOAD_LIMITER`, key = order id).

Refunds revoke access immediately because every download re-checks `status = 'paid'`.

## 5. Security Checklist

- [ ] No `node:crypto`; all HMAC/digests via `crypto.subtle`.
- [ ] Signature verified on raw body before `JSON.parse`; Paddle timestamp window enforced.
- [ ] Secrets only in `wrangler secret` / `.dev.vars`; rotated by adding the new secret, deploying, then removing the old.
- [ ] Prices, currency, email never taken from client input.
- [ ] Webhook routes excluded from `next-intl` middleware and from any auth middleware; they accept `POST` only.
- [ ] `EBOOKS_PRIVATE` has no public domain, no `r2.dev` access, and CORS limited to the admin origin for uploads (admin.md).
- [ ] Logs contain `order_ref`, provider ids, event ids — never emails, tokens, or raw payloads.
- [ ] Tests: valid/invalid/stale signatures, duplicate event, out-of-order refund, variant mismatch, download limit race, refunded download.
