'use server';

import { revalidatePath } from 'next/cache';
import { socialDeps } from '@/services/container';
import { saveSocialLinks, type SaveSocialLinksResult } from '@/services/settings/social.service';
import { socialLinksInputSchema } from '@/validators/settings';
import { requireAdmin } from '../_server/require-admin';

export async function saveSocialLinksAction(raw: unknown): Promise<SaveSocialLinksResult> {
  const admin = await requireAdmin();
  const parsed = socialLinksInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, invalid: [] };
  const result = await saveSocialLinks(socialDeps(), admin, parsed.data);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
