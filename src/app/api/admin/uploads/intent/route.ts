import { guardAdminApi } from '@/app/admin/_server/api-guard';
import { createUploadIntent } from '@/services/admin/upload.service';
import { uploadDeps } from '@/services/container';
import { uploadIntentSchema } from '@/validators/admin/upload';

const noStore = { 'cache-control': 'no-store' };

export async function POST(req: Request): Promise<Response> {
  const guard = await guardAdminApi(req);
  if (!guard.ok) return guard.response;
  const input = uploadIntentSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'invalid' }, { status: 400, headers: noStore });

  const result = await createUploadIntent(uploadDeps(), input.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 422, headers: noStore });
  return Response.json({ key: result.key, upload: result.upload }, { headers: noStore });
}
