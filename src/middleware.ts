// Edge middleware (not Next 16 `proxy.ts`): Node-runtime proxy is experimental on OpenNext Cloudflare.
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip API, admin (own auth, not localized), Next internals, and files with an extension.
  matcher: ['/((?!api|admin|_next|_vercel|media|.*\\..*).*)'],
};
