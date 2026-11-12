// Browser side of the presigned upload flow: intent → direct PUT to R2 → finalize.
import { z } from 'zod';
import type { UploadKind } from '@/validators/admin/upload';

const intentResponse = z.object({
  key: z.string(),
  upload: z.object({ url: z.string(), method: z.literal('PUT'), headers: z.record(z.string(), z.string()) }),
});
const finalizeResponse = z.object({ key: z.string(), publicUrl: z.string().nullable() });
const errorResponse = z.object({ error: z.string() });

export type UploadErrorCode = 'type' | 'size' | 'not_found' | 'bad_key' | 'missing_object' | 'network';

export type UploadOutcome = { ok: true; key: string; publicUrl: string | null } | { ok: false; error: UploadErrorCode };

function errorCode(body: unknown): UploadErrorCode {
  const parsed = errorResponse.safeParse(body);
  const code = parsed.success ? parsed.data.error : 'network';
  return code === 'type' || code === 'size' || code === 'not_found' || code === 'bad_key' || code === 'missing_object' ? code : 'network';
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; json: unknown }> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, json: await res.json().catch(() => null) };
}

export async function uploadFile(kind: UploadKind, entityId: string, file: File): Promise<UploadOutcome> {
  try {
    const intent = await postJson('/api/admin/uploads/intent', {
      kind,
      entityId,
      contentType: file.type,
      size: file.size,
      filename: file.name,
    });
    if (!intent.ok) return { ok: false, error: errorCode(intent.json) };
    const plan = intentResponse.parse(intent.json);

    const put = await fetch(plan.upload.url, { method: 'PUT', headers: plan.upload.headers, body: file });
    if (!put.ok) return { ok: false, error: 'network' };

    const fin = await postJson('/api/admin/uploads/finalize', { kind, entityId, key: plan.key });
    if (!fin.ok) return { ok: false, error: errorCode(fin.json) };
    const done = finalizeResponse.parse(fin.json);
    return { ok: true, key: done.key, publicUrl: done.publicUrl };
  } catch {
    return { ok: false, error: 'network' };
  }
}
