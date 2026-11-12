// Web Crypto helpers (Workers-safe). Never import node:crypto.
const enc = new TextEncoder();
const dec = new TextDecoder();

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/** Constant-time HMAC-SHA256 verification of a hex signature. */
export async function hmacVerifyHex(secret: string, message: string, signatureHex: string): Promise<boolean> {
  const sig = hexToBytes(signatureHex);
  if (!sig) return false;
  const key = await importHmacKey(secret, 'verify');
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(message));
}

export async function hmacSignHex(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret, 'sign');
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export function randomToken(byteLength = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** `base64url(JSON payload).base64url(HMAC-SHA256(secret, payloadPart))` */
export async function signToken(secret: string, payload: Record<string, unknown>): Promise<string> {
  const body = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret, 'sign');
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${base64UrlEncode(sig)}`;
}

/** Returns the decoded payload (unknown — validate with Zod) or null when the signature is invalid. */
export async function verifyToken(secret: string, token: string): Promise<unknown> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sigPart] = parts as [string, string];
  const sig = base64UrlDecode(sigPart);
  if (!sig || body.length === 0) return null;
  const key = await importHmacKey(secret, 'verify');
  const ok = await crypto.subtle.verify('HMAC', key, sig, enc.encode(body));
  if (!ok) return null;
  const raw = base64UrlDecode(body);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(dec.decode(raw));
    return parsed;
  } catch {
    return null;
  }
}
