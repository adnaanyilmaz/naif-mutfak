import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

// Module scope survives across requests in the same isolate; jose also caches fetched keys.
const cache = new Map<string, JWTVerifyGetKey>();

/** Cloudflare Access signing keys for `issuer` (`https://<team>.cloudflareaccess.com`). */
export function accessJwks(issuer: string): JWTVerifyGetKey {
  let jwks = cache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    cache.set(issuer, jwks);
  }
  return jwks;
}
