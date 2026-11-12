// The admin security boundary: called by admin/layout.tsx, every Server Action and every /api/admin handler.
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { adminAuthDeps } from '@/services/container';
import {
  AdminForbiddenError,
  AdminUnauthorizedError,
  authenticateAdmin,
  type AdminIdentity,
} from '@/services/admin/auth.service';

async function authenticate(): Promise<AdminIdentity> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return authenticateAdmin(
    {
      jwtHeader: h.get('cf-access-jwt-assertion'),
      cookieToken: c.get('CF_Authorization')?.value ?? null,
      host: h.get('host'),
    },
    adminAuthDeps(),
  );
}

/** Throws AdminUnauthorizedError / AdminForbiddenError. Memoized per request. */
export const requireAdmin = cache(authenticate);

/** For the layout: identity, or the failure kind to render. */
export async function getAdminOrFailure(): Promise<AdminIdentity | 'unauthorized' | 'forbidden'> {
  try {
    return await requireAdmin();
  } catch (err) {
    if (err instanceof AdminForbiddenError) return 'forbidden';
    if (err instanceof AdminUnauthorizedError) return 'unauthorized';
    throw err;
  }
}
