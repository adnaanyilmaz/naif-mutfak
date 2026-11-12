import { describe, expect, it } from 'vitest';
import { createFakeSubscribersRepo, fakeId } from '@/test/fakes';
import { subscribeInputSchema } from '@/validators/api';
import { subscribe } from './subscribe.service';

const input = { email: '  Ada@Example.COM ', locale: 'tr' as const, source: 'footer' as const, referrerPath: '/tr', utm: null };
const now = () => new Date('2026-11-12T12:00:00Z');

describe('subscribe', () => {
  it('creates a pending subscriber with a normalized email and hashed tokens', async () => {
    const fake = createFakeSubscribersRepo();
    const res = await subscribe({ subscribers: fake.repo, now, newId: fakeId }, input);
    expect(res.outcome).toBe('created');
    expect(res.confirmToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fake.rows).toEqual([expect.objectContaining({ email: 'ada@example.com', status: 'pending' })]);
  });

  it('leaves pending/active addresses unchanged', async () => {
    const fake = createFakeSubscribersRepo([{ id: 's1', email: 'ada@example.com', status: 'active' }]);
    const res = await subscribe({ subscribers: fake.repo, now, newId: fakeId }, input);
    expect(res).toEqual({ outcome: 'unchanged', confirmToken: null });
    expect(fake.rows[0]?.status).toBe('active');
  });

  it('re-subscribes an unsubscribed address back to pending (double opt-in again)', async () => {
    const fake = createFakeSubscribersRepo([{ id: 's1', email: 'ada@example.com', status: 'unsubscribed' }]);
    const res = await subscribe({ subscribers: fake.repo, now, newId: fakeId }, input);
    expect(res.outcome).toBe('resubscribed');
    expect(fake.resets).toEqual(['s1']);
  });
});

describe('subscribeInputSchema', () => {
  const body = { email: 'a@b.co', locale: 'en', source: 'footer', consent: true };

  it('accepts a minimal valid body and defaults optional fields to null', () => {
    expect(subscribeInputSchema.parse(body)).toEqual({ ...body, referrerPath: null, utm: null });
  });

  it('rejects missing consent, server-only sources, bad emails and external referrers', () => {
    expect(subscribeInputSchema.safeParse({ ...body, consent: false }).success).toBe(false);
    expect(subscribeInputSchema.safeParse({ ...body, source: 'checkout' }).success).toBe(false);
    expect(subscribeInputSchema.safeParse({ ...body, email: 'nope' }).success).toBe(false);
    expect(subscribeInputSchema.safeParse({ ...body, locale: 'de' }).success).toBe(false);
    expect(subscribeInputSchema.safeParse({ ...body, referrerPath: '//evil.com' }).success).toBe(false);
    expect(subscribeInputSchema.safeParse({ ...body, referrerPath: '/tr?email=a@b.co' }).success).toBe(false);
  });
});
