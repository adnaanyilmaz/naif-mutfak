import { guardAdminApi } from '@/app/admin/_server/api-guard';
import { finalizeUpload } from '@/services/admin/upload.service';
import { uploadDeps } from '@/services/container';
import { uploadFinalizeSchema } from '@/validators/admin/upload';

const noStore = { 'cache-control': 'no-store' };

export async function POST(req: Request): Promise<Response> {
  const guard = await guardAdminApi(req);
  if (!guard.ok) return guard.response;
  const input = uploadFinalizeSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'invalid' }, { status: 400, headers: noStore });

  const result = await finalizeUpload(uploadDeps(), guard.admin, input.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 422, headers: noStore });
  return Response.json({ key: result.key, publicUrl: result.publicUrl }, { headers: noStore });
}
