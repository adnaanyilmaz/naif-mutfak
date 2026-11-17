'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  checkSlug,
  createDraftPost,
  deletePost,
  savePost,
  type SavePostResult,
  type SlugCheck,
} from '@/services/admin/posts-admin.service';
import { translationToForm } from '@/services/admin/post-form';
import { translatePost, type TranslateError } from '@/services/admin/post-translate.service';
import type { TranslationStatus } from '@/services/translation/content-hash';
import { adminPostsDeps, deletePostDeps, postTranslateDeps } from '@/services/container';
import { checkSlugInputSchema, postIdSchema, savePostInputSchema } from '@/validators/admin/post';
import type { TranslationForm } from '@/validators/admin/post-form';
import { translateInputSchema, type TargetLocale } from '@/validators/admin/translation';
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

/** Redirects to the list on success; returns the reason otherwise. */
export async function deletePostAction(raw: unknown): Promise<{ error: 'not_found' }> {
  const admin = await requireAdmin();
  const id = postIdSchema.safeParse(raw);
  if (!id.success) return { error: 'not_found' };
  const result = await deletePost(deletePostDeps(), admin, id.data);
  if (!result.ok) return { error: result.error };
  for (const path of result.revalidate) revalidatePath(path);
  revalidatePath('/admin/posts');
  redirect('/admin/posts');
}

export async function checkSlugAction(raw: unknown): Promise<SlugCheck> {
  await requireAdmin();
  const parsed = checkSlugInputSchema.safeParse(raw);
  if (!parsed.success) return 'invalid';
  return checkSlug(adminPostsDeps(), parsed.data.postId, parsed.data.locale, parsed.data.slug);
}

export type TranslateActionResult =
  | { ok: true; locale: TargetLocale; form: TranslationForm; status: TranslationStatus }
  | { ok: false; error: TranslateError | 'invalid' };

/** Translates the saved Turkish version into one target locale as an unpublished draft. */
export async function translatePostAction(raw: unknown): Promise<TranslateActionResult> {
  const admin = await requireAdmin();
  const parsed = translateInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const result = await translatePost(postTranslateDeps(), admin, parsed.data);
  if (!result.ok) return result;
  for (const path of result.revalidate) revalidatePath(path);
  revalidatePath('/admin/posts');
  return { ok: true, locale: parsed.data.locale, form: translationToForm(result.translation), status: result.status };
}
