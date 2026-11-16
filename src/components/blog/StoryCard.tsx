import { hasLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { EditorialImage } from '@/components/media/EditorialImage';
import { getCategoryLabeler } from '@/i18n/category-label';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type { PostCardView } from '@/services/content/posts.service';
import { RecipeMeta } from './RecipeMeta';

interface StoryCardProps {
  post: PostCardView;
  size?: 'feature' | 'default' | 'compact';
  priority?: boolean;
}

export async function StoryCard({ post, size = 'default', priority = false }: StoryCardProps) {
  const requested = await getLocale();
  const label = await getCategoryLabeler(hasLocale(routing.locales, requested) ? requested : routing.defaultLocale);
  const href = `/blog/${post.slug}`;
  const category = label(post.category);

  if (size === 'feature') {
    // Full-bleed image card with the title over a gradient (home hero).
    return (
      <article className="group relative">
        <EditorialImage src={post.imageUrl} alt={post.imageAlt} aspect="aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]" category={post.category} priority zoom radius="rounded-[2rem]" />
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          {category && <span className="inline-flex rounded-pill bg-white/90 px-3 py-1 text-[0.75rem] font-semibold text-charcoal backdrop-blur">{category}</span>}
          <h2 className="mt-3 font-display text-h2 font-extrabold text-white">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-[2rem] focus-visible:outline-none">
              {post.title}
            </Link>
          </h2>
          <div className="mt-3">
            <RecipeMeta totalMinutes={post.totalMinutes} difficulty={post.difficulty} tone="inverted" />
          </div>
        </div>
      </article>
    );
  }

  if (size === 'compact') {
    return (
      <article className="group relative grid grid-cols-[5.5rem_1fr] items-center gap-4">
        <EditorialImage src={post.imageUrl} alt={post.imageAlt} aspect="aspect-square" category={post.category} zoom radius="rounded-2xl" />
        <div>
          {category && <p className="text-[0.75rem] font-semibold text-terracotta">{category}</p>}
          <h3 className="mt-1 font-display text-[1.0625rem] leading-snug font-bold">
            <Link href={href} className="after:absolute after:inset-0 group-hover:text-terracotta">
              {post.title}
            </Link>
          </h3>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col">
      <div className="relative">
        <EditorialImage src={post.imageUrl} alt={post.imageAlt} aspect="aspect-[4/3]" category={post.category} priority={priority} zoom />
        {category && (
          <span className="absolute start-3 top-3 rounded-pill bg-white/90 px-3 py-1 text-[0.75rem] font-semibold text-charcoal shadow-sm backdrop-blur">
            {category}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        <RecipeMeta totalMinutes={post.totalMinutes} difficulty={post.difficulty} />
        <h3 className="font-display text-h3 font-bold transition-colors duration-200 group-hover:text-terracotta">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {post.title}
          </Link>
        </h3>
        {post.dek && <p className="line-clamp-2 text-ui text-stone">{post.dek}</p>}
      </div>
    </article>
  );
}
