// /api/admin/* guard: requireAdmin + same-origin + JSON body (CSRF, admin.md §1).
import { AdminForbiddenError, AdminUnauthorizedError, type AdminIdentity } from '@/services/admin/auth.service';
import { requireAdmin } from './require-admin';

export type GuardResult = { ok: true; admin: AdminIdentity } | { ok: false; response: Response };

const deny = (status: 401 | 403 | 415, error: string): GuardResult => ({
  ok: false,
  response: Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } }),
});

export async function guardAdminApi(req: Request, opts: { json: boolean } = { json: true }): Promise<GuardResult> {
  try {
    const admin = await requireAdmin();
    const origin = req.headers.get('origin');
    if (origin !== new URL(req.url).origin) return deny(403, 'bad_origin');
    if (opts.json && !(req.headers.get('content-type') ?? '').startsWith('application/json')) return deny(415, 'json_required');
    return { ok: true, admin };
  } catch (err) {
    if (err instanceof AdminForbiddenError) return deny(403, 'forbidden');
    if (err instanceof AdminUnauthorizedError) return deny(401, 'unauthorized');
    throw err;
  }
}

/** For GET downloads (navigation has no Origin): reject cross-site fetches via Sec-Fetch-Site. */
export async function guardAdminDownload(req: Request): Promise<GuardResult> {
  try {
    const admin = await requireAdmin();
    const site = req.headers.get('sec-fetch-site');
    if (site !== null && site !== 'same-origin' && site !== 'none') return deny(403, 'bad_origin');
    return { ok: true, admin };
  } catch (err) {
    if (err instanceof AdminForbiddenError) return deny(403, 'forbidden');
    if (err instanceof AdminUnauthorizedError) return deny(401, 'unauthorized');
    throw err;
  }
}
