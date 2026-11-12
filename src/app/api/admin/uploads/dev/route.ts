// Local development only: stands in for the presigned R2 PUT when no S3 credentials are configured.
import { guardAdminApi } from '@/app/admin/_server/api-guard';
import { storeDevUpload } from '@/services/admin/upload.service';
import { devUploadsEnabled, devUploadStores } from '@/services/container';
import { devUploadQuerySchema } from '@/validators/admin/upload';

export async function PUT(req: Request): Promise<Response> {
  if (!devUploadsEnabled()) return new Response(null, { status: 404 });
  const guard = await guardAdminApi(req, { json: false });
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const query = devUploadQuerySchema.safeParse({ bucket: url.searchParams.get('bucket'), key: url.searchParams.get('key') });
  if (!query.success) return Response.json({ error: 'bad_key' }, { status: 400 });
  const stored = await storeDevUpload(
    devUploadStores(),
    query.data.bucket,
    query.data.key,
    await req.arrayBuffer(),
    req.headers.get('content-type') ?? 'application/octet-stream',
  );
  return stored ? new Response(null, { status: 200 }) : Response.json({ error: 'bad_key' }, { status: 400 });
}
