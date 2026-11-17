import { getTranslations } from 'next-intl/server';
import type { RecipeView } from '@/services/content/posts.service';
import { splitDuration } from '@/services/recipe/duration';
import { PrintButton } from './PrintButton';
import { RecipeCardInteractive } from './RecipeCardInteractive';
import { RecipeVideo } from './RecipeVideo';

const DIFFICULTY_KEY = {
  easy: 'difficultyEasy',
  medium: 'difficultyMedium',
  advanced: 'difficultyAdvanced',
} as const;

export async function RecipeCard({ recipe }: { recipe: RecipeView }) {
  const t = await getTranslations('Recipe');

  const duration = (minutes: number) => {
    const { h, m } = splitDuration(minutes);
    if (h === 0) return t('durationM', { m });
    return m === 0 ? t('durationH', { h }) : t('durationHM', { h, m });
  };

  const meta: { label: string; value: string }[] = [];
  if (recipe.prepMinutes !== null) meta.push({ label: t('prep'), value: duration(recipe.prepMinutes) });
  if (recipe.cookMinutes !== null) meta.push({ label: t('cook'), value: duration(recipe.cookMinutes) });
  if (recipe.restMinutes) meta.push({ label: t('rest'), value: duration(recipe.restMinutes) });
  if (recipe.totalMinutes !== null) meta.push({ label: t('total'), value: duration(recipe.totalMinutes) });
  if (recipe.difficulty) meta.push({ label: t('difficulty'), value: t(DIFFICULTY_KEY[recipe.difficulty]) });

  return (
    <section
      id="recipe"
      aria-labelledby="recipe-title"
      className="recipe-card mx-auto mt-16 w-full max-w-[min(100%,48rem)] scroll-mt-28 rounded-[2rem] border border-hairline bg-white p-5 shadow-card sm:p-8 md:p-10 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.8125rem] font-semibold text-terracotta">{t('eyebrow')}</p>
          <h2 id="recipe-title" className="mt-1 font-display text-h2 font-extrabold">
            {recipe.title}
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {recipe.video && (
            <RecipeVideo
              youtubeId={recipe.video.youtubeId}
              mode={recipe.video.mode}
              title={t('videoTitle', { title: recipe.title })}
              labels={{ watch: t('watchVideo'), close: t('closeVideo') }}
            />
          )}
          <PrintButton label={t('print')} />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label} className="rounded-2xl bg-linen px-4 py-3 print:bg-transparent print:px-0">
            <dt className="text-[0.75rem] font-medium text-muted">{m.label}</dt>
            <dd className="mt-0.5 text-ui font-bold tabular-nums">{m.value}</dd>
          </div>
        ))}
      </dl>

      <RecipeCardInteractive
        postId={recipe.postId}
        baseServings={recipe.baseServings}
        ingredients={recipe.ingredients}
        instructions={recipe.instructions}
        stepImageUrls={recipe.stepImageUrls}
      />
    </section>
  );
}
