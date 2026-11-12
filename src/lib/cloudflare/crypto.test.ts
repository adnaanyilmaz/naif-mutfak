import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode, hexToBytes, hmacSignHex, hmacVerifyHex, sha256Hex, signToken, verifyToken } from './crypto';

const SECRET = 'test-secret-0123456789abcdef0123456789';

// Reference HMAC from Node is used only in tests to cross-check the Web Crypto implementation.
const nodeHmac = (secret: string, msg: string) => createHmac('sha256', secret).update(msg).digest('hex');

describe('hmacVerifyHex (crypto.subtle.verify)', () => {
  it('accepts a correct signature (cross-checked with an independent HMAC)', async () => {
    const msg = '{"meta":{"event_name":"order_created"}}';
    expect(await hmacVerifyHex(SECRET, msg, nodeHmac(SECRET, msg))).toBe(true);
    expect(await hmacSignHex(SECRET, msg)).toBe(nodeHmac(SECRET, msg));
  });

  it('accepts uppercase hex', async () => {
    expect(await hmacVerifyHex(SECRET, 'x', nodeHmac(SECRET, 'x').toUpperCase())).toBe(true);
  });

  it('rejects a modified body, wrong secret, or truncated signature', async () => {
    const sig = nodeHmac(SECRET, 'body');
    expect(await hmacVerifyHex(SECRET, 'body ', sig)).toBe(false);
    expect(await hmacVerifyHex('other-secret', 'body', sig)).toBe(false);
    expect(await hmacVerifyHex(SECRET, 'body', sig.slice(0, 62))).toBe(false);
  });

  it('rejects malformed hex without throwing', async () => {
    for (const bad of ['', 'zz', 'abc', 'g'.repeat(64)]) {
      expect(await hmacVerifyHex(SECRET, 'body', bad)).toBe(false);
    }
    expect(hexToBytes('0aff')).toEqual(new Uint8Array([10, 255]));
  });
});

describe('sha256Hex', () => {
  it('matches the known digest', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('signToken / verifyToken', () => {
  it('round-trips a payload', async () => {
    const token = await signToken(SECRET, { typ: 'dl', o: 'x', exp: 1 });
    expect(await verifyToken(SECRET, token)).toEqual({ typ: 'dl', o: 'x', exp: 1 });
  });

  it('rejects tampered payloads, foreign secrets and garbage', async () => {
    const token = await signToken(SECRET, { typ: 'dl', o: 'x', exp: 1 });
    const [body = '', sig = ''] = token.split('.');
    const forged = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'dl', o: 'y', exp: 1 })));
    expect(await verifyToken(SECRET, `${forged}.${sig}`)).toBeNull();
    expect(await verifyToken('another-secret-0123456789abcdef', token)).toBeNull();
    expect(await verifyToken(SECRET, body)).toBeNull();
    expect(await verifyToken(SECRET, `${body}.${sig}.x`)).toBeNull();
    expect(await verifyToken(SECRET, `${body}.!!!`)).toBeNull();
  });

  it('base64url round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 251, 255, 62, 63]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
  });
});
