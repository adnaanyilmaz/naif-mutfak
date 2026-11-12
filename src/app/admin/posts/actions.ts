'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  checkSlug,
  createDraftPost,
  savePost,
  type SavePostResult,
  type SlugCheck,
} from '@/services/admin/posts-admin.service';
import { adminPostsDeps } from '@/services/container';
import { checkSlugInputSchema, savePostInputSchema } from '@/validators/admin/post';
import { requireAdmin } from '../_server/require-admin';

export async function createPostAction(): Promise<void> {
  const admin = await requireAdmin();
  const id = await createDraftPost(adminPostsDeps(), admin);
  redirect(`/admin/posts/${id}`);
}

export async function savePostAction(raw: unknown): Promise<SavePostResult> {
  const admin = await requireAdmin();
  const parsed = savePostInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: 'invalid' })),
    };
  }
  const result = await savePost(adminPostsDeps(), admin, parsed.data);
  if (result.ok) {
    for (const path of result.revalidate) revalidatePath(path);
    revalidatePath('/admin/posts');
  }
  return result;
}

export async function checkSlugAction(raw: unknown): Promise<SlugCheck> {
  await requireAdmin();
  const parsed = checkSlugInputSchema.safeParse(raw);
  if (!parsed.success) return 'invalid';
  return checkSlug(adminPostsDeps(), parsed.data.postId, parsed.data.locale, parsed.data.slug);
}
