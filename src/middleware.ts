// Edge middleware (not Next 16 `proxy.ts`): Node-runtime proxy is experimental on OpenNext Cloudflare.
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const intl = createMiddleware(routing);

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
}

// Fast reject only: no Access token and not local development → 403. The security boundary is
// requireAdmin() (full JWT verification) in the admin layout, every Server Action and /api/admin handler.
function adminGate(req: NextRequest): NextResponse {
  const hasToken = req.headers.has('cf-access-jwt-assertion') || req.cookies.has('CF_Authorization');
  const localDev = process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(req.nextUrl.hostname);
  if (hasToken || localDev) {
    const res = NextResponse.next();
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export default function middleware(req: NextRequest) {
  return isAdminPath(req.nextUrl.pathname) ? adminGate(req) : intl(req);
}

export const config = {
  // Public pages: skip API, admin, Next internals, and files with an extension. Admin: fast gate above.
  matcher: ['/((?!api|admin|_next|_vercel|media|.*\..*).*)', '/admin/:path*', '/api/admin/:path*'],
};
