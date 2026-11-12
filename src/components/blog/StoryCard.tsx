import { getTranslations } from 'next-intl/server';
import { EditorialImage } from '@/components/media/EditorialImage';
import { Link } from '@/i18n/navigation';
import { categoryKey } from '@/services/content/category';
import type { PostCardView } from '@/services/content/posts.service';

interface StoryCardProps {
  post: PostCardView;
  size?: 'lead' | 'default' | 'compact';
}

export async function StoryCard({ post, size = 'default' }: StoryCardProps) {
  const t = await getTranslations('Categories');
  const href = `/blog/${post.slug}`;
  const aspect = size === 'lead' ? 'aspect-[4/5]' : size === 'compact' ? 'aspect-square' : 'aspect-[3/2]';
  const titleClass = size === 'lead' ? 'text-h1' : size === 'compact' ? 'text-h3' : 'text-h2';

  return (
    <article className={size === 'compact' ? 'group grid grid-cols-[7rem_1fr] items-start gap-5' : 'group'}>
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        <EditorialImage src={post.imageUrl} alt={post.imageAlt} aspect={aspect} monogram={post.title.charAt(0)} priority={size === 'lead'} />
      </Link>
      <div className={size === 'compact' ? '' : 'mt-5'}>
        <p className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">{t(categoryKey(post.category))}</p>
        <h3 className={`mt-2 font-display font-semibold ${titleClass}`}>
          <Link
            href={href}
            className="decoration-terracotta decoration-1 underline-offset-4 transition-colors duration-200 ease-editorial group-hover:underline"
          >
            {post.title}
          </Link>
        </h3>
        {post.dek && size !== 'compact' && (
          <p className="mt-3 font-serif text-dek text-stone italic arabic:not-italic">{post.dek}</p>
        )}
      </div>
    </article>
  );
}
