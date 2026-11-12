import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseAdminEnv } from '@/validators/env';
import {
  AdminForbiddenError,
  AdminUnauthorizedError,
  authenticateAdmin,
  isLocalHost,
  type AdminAuthConfig,
  type AdminAuthDeps,
} from './auth.service';

const TEAM = 'naif.cloudflareaccess.com';
const AUD = 'aud-0123456789abcdef0123456789abcdef';
let privateKey: CryptoKey;
let otherKey: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
  otherKey = (await generateKeyPair('RS256')).privateKey;
});

const config = (over: Partial<AdminAuthConfig> = {}): AdminAuthConfig => ({
  environment: 'production',
  teamDomain: TEAM,
  audience: AUD,
  adminEmails: ['chef@naifmutfak.com'],
  devEmail: undefined,
  ...over,
});

const deps = (over: Partial<AdminAuthConfig> = {}): AdminAuthDeps => ({
  config: config(over),
  getKey: () => createLocalJWKSet({ keys: [jwk] }),
});

async function token(claims: Record<string, unknown> = {}, opts: { key?: CryptoKey; aud?: string; iss?: string; exp?: string } = {}) {
  return new SignJWT({ email: 'Chef@NaifMutfak.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? `https://${TEAM}`)
    .setAudience(opts.aud ?? AUD)
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m')
    .sign(opts.key ?? privateKey);
}

const req = (jwtHeader: string | null, host = 'naifmutfak.com', cookieToken: string | null = null) => ({ jwtHeader, cookieToken, host });

describe('authenticateAdmin', () => {
  it('accepts a valid Access JWT for an allowlisted email (case-insensitive)', async () => {
    await expect(authenticateAdmin(req(await token()), deps())).resolves.toEqual({
      email: 'chef@naifmutfak.com',
      sub: 'user-1',
      via: 'access',
    });
  });

  it('falls back to the CF_Authorization cookie', async () => {
    await expect(authenticateAdmin(req(null, 'naifmutfak.com', await token()), deps())).resolves.toMatchObject({ via: 'access' });
  });

  it.each([
    ['wrong audience', { aud: 'someone-else-0123456789' }],
    ['wrong issuer', { iss: 'https://evil.cloudflareaccess.com' }],
    ['foreign signing key', { key: 'other' }],
    ['expired', { exp: '-1m' }],
  ])('rejects %s', async (_name, opts) => {
    const t = await token({}, { ...opts, key: 'key' in opts ? otherKey : privateKey });
    await expect(authenticateAdmin(req(t), deps())).rejects.toMatchObject({ reason: 'invalid_token' });
  });

  it('forbids a verified but non-allowlisted email', async () => {
    const t = await token({ email: 'intruder@example.com' });
    await expect(authenticateAdmin(req(t), deps())).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  it('rejects tokens without an email claim', async () => {
    const t = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(`https://${TEAM}`).setAudience(AUD).setSubject('s').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    await expect(authenticateAdmin(req(t), deps())).rejects.toMatchObject({ reason: 'invalid_claims' });
  });

  it('rejects a missing token outside local development', async () => {
    await expect(authenticateAdmin(req(null), deps())).rejects.toBeInstanceOf(AdminUnauthorizedError);
    await expect(authenticateAdmin(req(null, 'localhost:3000'), deps({ devEmail: 'dev@example.com' }))).rejects.toMatchObject({
      reason: 'missing_token',
    });
  });

  it('allows the dev email only in development on localhost', async () => {
    const dev = { environment: 'development' as const, devEmail: 'dev@example.com', teamDomain: undefined, audience: undefined };
    await expect(authenticateAdmin(req(null, 'localhost:3000'), deps(dev))).resolves.toMatchObject({ email: 'dev@example.com', via: 'dev' });
    await expect(authenticateAdmin(req(null, '127.0.0.1:8787'), deps(dev))).resolves.toMatchObject({ via: 'dev' });
    await expect(authenticateAdmin(req(null, 'naif-mutfak.workers.dev'), deps(dev))).rejects.toBeInstanceOf(AdminUnauthorizedError);
    await expect(authenticateAdmin(req(null, 'localhost.evil.com'), deps(dev))).rejects.toBeInstanceOf(AdminUnauthorizedError);
  });
});

describe('isLocalHost', () => {
  it('matches loopback hosts only', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('[::1]:3000')).toBe(true);
    expect(isLocalHost('localhost.example.com')).toBe(false);
    expect(isLocalHost(null)).toBe(false);
  });
});

describe('adminEnvSchema', () => {
  const base = { ENVIRONMENT: 'production', SITE_URL: 'https://naifmutfak.com', ADMIN_EMAILS: ' Chef@NaifMutfak.com, ops@naifmutfak.com ' };
  const access = { CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD };

  it('normalizes the allowlist', () => {
    expect(parseAdminEnv({ ...base, ...access }).ADMIN_EMAILS).toEqual(['chef@naifmutfak.com', 'ops@naifmutfak.com']);
  });

  it('fails production config when ADMIN_DEV_EMAIL is set', () => {
    expect(() => parseAdminEnv({ ...base, ...access, ADMIN_DEV_EMAIL: 'dev@example.com' })).toThrow(/ADMIN_DEV_EMAIL/);
  });

  it('requires Access outside development, but not locally', () => {
    expect(() => parseAdminEnv({ ...base, ENVIRONMENT: 'preview' })).toThrow(/Access/);
    expect(parseAdminEnv({ ...base, ENVIRONMENT: 'development', CF_ACCESS_AUD: '' }).CF_ACCESS_AUD).toBeUndefined();
  });
});
