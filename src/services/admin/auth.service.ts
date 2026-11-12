// Admin authentication (admin.md §1). Cloudflare Access is the edge gate; this re-verifies the
// Access JWT in the Worker so a misconfigured policy or renamed route cannot expose `/admin`.
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

export interface AdminIdentity {
  email: string;
  sub: string;
  via: 'access' | 'dev';
}

export interface AdminAuthConfig {
  environment: 'development' | 'preview' | 'production';
  teamDomain: string | undefined;
  audience: string | undefined;
  adminEmails: readonly string[];
  devEmail: string | undefined;
}

export interface AdminAuthDeps {
  config: AdminAuthConfig;
  /** JWKS resolver for an Access issuer (remote + cached in production, local set in tests). */
  getKey: (issuer: string) => JWTVerifyGetKey;
}

export interface AdminRequest {
  /** `Cf-Access-Jwt-Assertion` header injected by Access. */
  jwtHeader: string | null;
  /** `CF_Authorization` cookie (fallback). */
  cookieToken: string | null;
  host: string | null;
}

export type AdminAuthFailure = 'missing_token' | 'access_not_configured' | 'invalid_token' | 'invalid_claims';

export class AdminUnauthorizedError extends Error {
  readonly reason: AdminAuthFailure;

  constructor(reason: AdminAuthFailure) {
    super(`Admin authentication failed: ${reason}`);
    this.name = 'AdminUnauthorizedError';
    this.reason = reason;
  }
}

export class AdminForbiddenError extends Error {
  constructor() {
    super('Not an allowlisted admin');
    this.name = 'AdminForbiddenError';
  }
}

const accessClaimsSchema = z.object({
  email: z.email(),
  sub: z.string().min(1),
  exp: z.number(),
  iat: z.number(),
});

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Host header without port; `[::1]:3000` → `[::1]`. */
export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : (host.split(':')[0] ?? '');
  return LOCAL_HOSTS.has(name.toLowerCase());
}

function devIdentity(req: AdminRequest, config: AdminAuthConfig): AdminIdentity | null {
  if (config.environment !== 'development' || !config.devEmail || !isLocalHost(req.host)) return null;
  return { email: config.devEmail, sub: 'dev', via: 'dev' };
}

export async function authenticateAdmin(req: AdminRequest, deps: AdminAuthDeps): Promise<AdminIdentity> {
  const { config } = deps;
  const token = req.jwtHeader || req.cookieToken;
  if (!token) {
    const dev = devIdentity(req, config);
    if (dev) return dev;
    throw new AdminUnauthorizedError('missing_token');
  }
  if (!config.teamDomain || !config.audience) {
    const dev = devIdentity(req, config);
    if (dev) return dev;
    throw new AdminUnauthorizedError('access_not_configured');
  }

  const issuer = `https://${config.teamDomain}`;
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, deps.getKey(issuer), {
      issuer,
      audience: config.audience,
      algorithms: ['RS256'],
    }));
  } catch {
    throw new AdminUnauthorizedError('invalid_token');
  }

  const claims = accessClaimsSchema.safeParse(payload);
  if (!claims.success) throw new AdminUnauthorizedError('invalid_claims');
  const email = claims.data.email.toLowerCase();
  if (!config.adminEmails.includes(email)) throw new AdminForbiddenError();
  return { email, sub: claims.data.sub, via: 'access' };
}
