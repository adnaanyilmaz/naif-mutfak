import { getTranslations } from 'next-intl/server';
import { splitDuration } from '@/services/recipe/duration';

const DIFFICULTY_KEY = { easy: 'difficultyEasy', medium: 'difficultyMedium', advanced: 'difficultyAdvanced' } as const;

interface RecipeMetaProps {
  totalMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'advanced' | null;
  tone?: 'default' | 'inverted';
}

function ClockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-3.5">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" strokeLinecap="round" />
    </svg>
  );
}

function BarsIcon({ level }: { level: number }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.5} y={10 - i * 3} width="3" height={4 + i * 3} rx="1" fill="currentColor" opacity={i < level ? 1 : 0.3} />
      ))}
    </svg>
  );
}

/** "⏱ 2 sa 30 dk · ▮▮▯ Orta" chips for recipe cards and article headers. */
export async function RecipeMeta({ totalMinutes, difficulty, tone = 'default' }: RecipeMetaProps) {
  if (totalMinutes === null && difficulty === null) return null;
  const t = await getTranslations('Recipe');
  const chip =
    tone === 'inverted'
      ? 'inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-2.5 py-1 text-[0.8125rem] font-medium text-white backdrop-blur'
      : 'inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-stone';

  let duration: string | null = null;
  if (totalMinutes !== null) {
    const { h, m } = splitDuration(totalMinutes);
    duration = h === 0 ? t('durationM', { m }) : m === 0 ? t('durationH', { h }) : t('durationHM', { h, m });
  }

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {duration && (
        <span className={chip}>
          <ClockIcon />
          <span className="sr-only">{t('total')}: </span>
          {duration}
        </span>
      )}
      {difficulty && (
        <span className={chip}>
          <BarsIcon level={difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3} />
          <span className="sr-only">{t('difficulty')}: </span>
          {t(DIFFICULTY_KEY[difficulty])}
        </span>
      )}
    </p>
  );
}
