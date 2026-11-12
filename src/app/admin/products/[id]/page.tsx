import { notFound } from 'next/navigation';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { getProductForEdit } from '@/services/admin/products-admin.service';
import { adminProductsDeps } from '@/services/container';
import { productIdSchema } from '@/validators/admin/product';
import { requireAdmin } from '../../_server/require-admin';
import { saveProductAction } from '../actions';

export default async function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = productIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const view = await getProductForEdit(adminProductsDeps(), id.data);
  if (!view) notFound();
  // Remount after each save so new variant ids and the concurrency token come from the server.
  return <ProductEditor key={view.updatedAtSeconds} view={view} saveAction={saveProductAction} />;
}
