import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
};

export default withNextIntl(nextConfig);

// Exposes wrangler bindings (D1, R2, vars) to `next dev` via getCloudflareContext().
// Workers AI only exists remotely: opt in with CF_REMOTE_BINDINGS=true in .env.local after `wrangler login`,
// so `next dev` still starts offline / logged out (auto-translation then reports "AI unavailable").
void initOpenNextCloudflareForDev({ remoteBindings: process.env.CF_REMOTE_BINDINGS === 'true' });
