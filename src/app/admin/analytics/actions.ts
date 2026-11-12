'use server';

import { revealOrderEmail } from '@/services/admin/analytics.service';
import { analyticsDeps } from '@/services/container';
import { revealEmailInputSchema } from '@/validators/admin/analytics';
import { requireAdmin } from '../_server/require-admin';

export async function revealOrderEmailAction(raw: unknown): Promise<string | null> {
  const admin = await requireAdmin();
  const input = revealEmailInputSchema.safeParse(raw);
  if (!input.success) return null;
  return revealOrderEmail(analyticsDeps(), admin, input.data.orderId);
}
