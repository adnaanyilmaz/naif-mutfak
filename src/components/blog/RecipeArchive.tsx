import type { PostCardView } from '@/services/content/posts.service';
import { CategoryChips } from './CategoryChips';
import { StoryCard } from './StoryCard';

interface RecipeArchiveProps {
  title: string;
  dek: string | null;
  posts: PostCardView[];
  emptyLabel: string;
  categories: ReadonlyArray<{ slug: string; label: string }>;
  activeCategory: string | null;
  allLabel: string;
  navLabel: string;
}

/** Recipe listing shared by the archive and the per-category pages. */
export function RecipeArchive({ title, dek, posts, emptyLabel, categories, activeCategory, allLabel, navLabel }: RecipeArchiveProps) {
  return (
    <div className="mx-auto max-w-page px-4 pt-10 pb-16 sm:px-6 md:pt-16 md:pb-24">
      <header className="max-w-content">
        <h1 className="font-display text-display font-extrabold">{title}</h1>
        {dek && <p className="mt-4 text-dek text-stone">{dek}</p>}
      </header>
      <CategoryChips categories={categories} active={activeCategory} allLabel={allLabel} navLabel={navLabel} />
      {posts.length === 0 ? (
        <p className="mt-16 text-ui text-stone">{emptyLabel}</p>
      ) : (
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p, i) => (
            <StoryCard key={p.id} post={p} priority={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
