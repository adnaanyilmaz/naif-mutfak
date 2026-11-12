'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createDraftProduct, saveProduct, type SaveProductResult } from '@/services/admin/products-admin.service';
import { adminProductsDeps } from '@/services/container';
import { saveProductInputSchema } from '@/validators/admin/product';
import { requireAdmin } from '../_server/require-admin';

export async function createProductAction(): Promise<void> {
  const admin = await requireAdmin();
  const id = await createDraftProduct(adminProductsDeps(), admin);
  redirect(`/admin/products/${id}`);
}

export async function saveProductAction(raw: unknown): Promise<SaveProductResult> {
  const admin = await requireAdmin();
  const parsed = saveProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: 'invalid' })),
    };
  }
  const result = await saveProduct(adminProductsDeps(), admin, parsed.data);
  if (result.ok) {
    for (const path of result.revalidate) revalidatePath(path);
    revalidatePath(`/admin/products/${parsed.data.productId}`);
  }
  return result;
}
