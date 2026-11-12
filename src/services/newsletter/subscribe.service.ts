import { randomToken, sha256Hex } from '@/lib/cloudflare/crypto';
import type { SubscriberSource, SubscribersRepo } from '@/repositories/subscribers';
import type { Locale, Utm } from '@/validators/content';

export interface SubscribeDeps {
  subscribers: SubscribersRepo;
  now: () => Date;
  newId: () => string;
}

export interface SubscribeInput {
  email: string;
  locale: Locale;
  source: SubscriberSource;
  referrerPath: string | null;
  utm: Utm | null;
}

/**
 * `created`: new pending subscriber · `resubscribed`: unsubscribed → pending · `unchanged`: already known.
 * The route returns the same response for all three (no address enumeration).
 * `confirmToken` is the raw double-opt-in token for the confirmation email (only its hash is stored).
 */
export type SubscribeResult =
  | { outcome: 'created' | 'resubscribed'; confirmToken: string }
  | { outcome: 'unchanged'; confirmToken: null };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function subscribe(deps: SubscribeDeps, input: SubscribeInput): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email);
  const existing = await deps.subscribers.findByEmail(email);
  if (existing && existing.status !== 'unsubscribed') return { outcome: 'unchanged', confirmToken: null };

  const confirmToken = randomToken();
  const tokens = {
    confirmTokenHash: await sha256Hex(confirmToken),
    unsubscribeTokenHash: await sha256Hex(randomToken()),
  };
  const consentAt = deps.now();

  if (existing) {
    await deps.subscribers.resetToPending(existing.id, { ...tokens, locale: input.locale, source: input.source, consentAt });
    return { outcome: 'resubscribed', confirmToken };
  }

  await deps.subscribers.insert({
    id: deps.newId(),
    email,
    locale: input.locale,
    source: input.source,
    referrerPath: input.referrerPath,
    utm: input.utm,
    consentAt,
    ...tokens,
  });
  return { outcome: 'created', confirmToken };
}
