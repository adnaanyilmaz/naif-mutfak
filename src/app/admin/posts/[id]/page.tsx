import { notFound } from 'next/navigation';
import { PostEditor } from '@/components/admin/PostEditor';
import { toPostForm } from '@/services/admin/post-form';
import { getPostForEdit, publicPathOf } from '@/services/admin/posts-admin.service';
import { listProductOptions } from '@/services/admin/products-admin.service';
import { adminPostsDeps, adminProductsDeps } from '@/services/container';
import { postIdSchema } from '@/validators/admin/post';
import { requireAdmin } from '../../_server/require-admin';
import { checkSlugAction, savePostAction } from '../actions';

export default async function AdminPostEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = postIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const deps = adminPostsDeps();
  const [view, products] = await Promise.all([getPostForEdit(deps, id.data), listProductOptions(adminProductsDeps())]);
  if (!view) notFound();

  return (
    <PostEditor
      postId={view.post.id}
      initialForm={toPostForm(view.post)}
      updatedAt={view.updatedAtSeconds}
      heroImageKey={view.post.heroImageKey}
      heroImageUrl={view.heroImageUrl}
      mediaBaseUrl={deps.mediaBaseUrl}
      siteUrl={deps.siteUrl}
      products={products}
      saveAction={savePostAction}
      checkSlugAction={checkSlugAction}
      publicPath={publicPathOf(view.post.status, view.post.translations)}
    />
  );
}
