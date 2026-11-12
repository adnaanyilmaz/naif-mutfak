import { getTranslations } from 'next-intl/server';
import type { RecipeView } from '@/services/content/posts.service';
import { splitDuration } from '@/services/recipe/duration';
import { PrintButton } from './PrintButton';
import { RecipeCardInteractive } from './RecipeCardInteractive';

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
      className="recipe-card mx-auto mt-16 w-full max-w-[min(100%,46rem)] scroll-mt-24 rounded-card border border-hairline bg-paper p-6 shadow-card md:p-10 print:mt-0 print:max-w-none print:border-0 print:p-0 print:shadow-none"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">{t('eyebrow')}</p>
          <h2 id="recipe-title" className="mt-2 font-display text-h2 font-semibold">
            {recipe.title}
          </h2>
        </div>
        <PrintButton label={t('print')} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hairline bg-hairline sm:grid-cols-3 md:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label} className="bg-paper px-3 py-3">
            <dt className="text-eyebrow font-semibold text-stone uppercase arabic:normal-case">{m.label}</dt>
            <dd className="mt-1 text-ui font-semibold tabular-nums">{m.value}</dd>
          </div>
        ))}
      </dl>

      <RecipeCardInteractive
        postId={recipe.postId}
        baseServings={recipe.baseServings}
        ingredients={recipe.ingredients}
        instructions={recipe.instructions}
      />
    </section>
  );
}
