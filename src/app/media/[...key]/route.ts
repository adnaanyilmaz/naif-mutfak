// Local development only. Production media is served by the bucket's custom domain + Image Transformations.
import { devMediaDeps } from '@/services/container';
import { readDevMedia } from '@/services/media/dev-media.service';

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const { key } = await params;
  const obj = await readDevMedia(devMediaDeps(), key.join('/'));
  if (!obj) return new Response(null, { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.contentType ?? 'application/octet-stream',
      'content-length': String(obj.size),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
