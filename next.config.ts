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
void initOpenNextCloudflareForDev();
