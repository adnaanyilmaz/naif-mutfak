'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { LOCALE_META } from '@/i18n/config';
import {
  clampServings,
  formatIngredientGroups,
  MAX_SERVINGS,
  MIN_SERVINGS,
  scaleFactor,
  SERVING_MULTIPLIERS,
} from '@/services/recipe/scale';
import { stepAnchor } from '@/services/seo/recipe-jsonld';
import type { Ingredients, Instructions } from '@/validators/content';
import { useRecipeProgress } from './use-recipe-progress';

interface RecipeCardInteractiveProps {
  postId: string;
  baseServings: number;
  ingredients: Ingredients;
  instructions: Instructions;
}

const chip =
  'min-h-11 min-w-11 rounded-pill border px-3 text-ui font-medium tabular-nums transition-colors duration-200 ease-editorial';

export function RecipeCardInteractive({ postId, baseServings, ingredients, instructions }: RecipeCardInteractiveProps) {
  const t = useTranslations('Recipe');
  const locale = useLocale();
  const [servings, setServings] = useState(baseServings);
  const progress = useRecipeProgress(`nm:recipe:${postId}:${locale}`);

  const factor = scaleFactor(servings, baseServings);
  const groups = useMemo(() => formatIngredientGroups(ingredients, factor, locale), [ingredients, factor, locale]);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_META[locale].intlTag), [locale]);
  const multiplierLabel = (m: number) => (m === 0.5 ? '½×' : `${nf.format(m)}×`);

  const sectionOffsets = instructions.map((_, si) => instructions.slice(0, si).reduce((n, s) => n + s.steps.length, 0));

  return (
    <>
      {/* Servings controls */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-hairline py-4 print:hidden">
        <div role="group" aria-label={t('multiplier')} className="flex flex-wrap gap-2">
          {SERVING_MULTIPLIERS.map((m) => {
            const target = clampServings(baseServings * m);
            const active = servings === target;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setServings(target)}
                className={`${chip} ${active ? 'border-terracotta bg-terracotta-tint text-terracotta-deep' : 'border-hairline bg-paper hover:border-terracotta'}`}
              >
                {multiplierLabel(m)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ui text-stone">{t('servings')}</span>
          <button
            type="button"
            aria-label={t('decrease')}
            disabled={servings <= MIN_SERVINGS}
            onClick={() => setServings((s) => clampServings(s - 1))}
            className={`${chip} border-hairline bg-paper disabled:opacity-40`}
          >
            −
          </button>
          <output aria-live="polite" className="min-w-8 text-center text-ui font-semibold tabular-nums">
            {nf.format(servings)}
          </output>
          <button
            type="button"
            aria-label={t('increase')}
            disabled={servings >= MAX_SERVINGS}
            onClick={() => setServings((s) => clampServings(s + 1))}
            className={`${chip} border-hairline bg-paper disabled:opacity-40`}
          >
            +
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {servings !== baseServings ? t('announce', { count: servings }) : ''}
        </p>
      </div>

      {/* Ingredients */}
      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-h3 font-semibold">{t('ingredients')}</h3>
          {progress.hasProgress && (
            <button type="button" onClick={progress.reset} className="text-ui text-terracotta underline underline-offset-4 print:hidden">
              {t('reset')}
            </button>
          )}
        </div>
        {groups.map((group, gi) => (
          <div key={gi} className="recipe-group mt-5">
            {group.title && <h4 className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">{group.title}</h4>}
            <ul className="mt-2 divide-y divide-hairline">
              {group.items.map((item) => {
                const isChecked = progress.checked.has(item.id);
                return (
                  <li key={item.id}>
                    <label
                      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-card px-2 py-2.5 transition-colors duration-200 ease-editorial ${isChecked ? 'bg-olive-tint text-stone line-through print:bg-transparent print:no-underline' : 'hover:bg-linen'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => progress.toggleIngredient(item.id)}
                        className="mt-1 size-5 shrink-0 accent-olive print:hidden"
                      />
                      <span className="hidden print:inline" aria-hidden>
                        ☐
                      </span>
                      <span className="text-ui">
                        {item.amount && <strong className="font-semibold tabular-nums">{item.amount}</strong>}
                        {item.unit && <span className="font-semibold"> {item.unit}</span>} {item.name}
                        {item.note && <span className="text-stone"> ({item.note})</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-10">
        <h3 className="font-display text-h3 font-semibold">{t('instructions')}</h3>
        {instructions.map((section, si) => (
          <div key={si} className="recipe-group mt-5">
            {section.title && (
              <h4 className="text-eyebrow font-semibold text-olive uppercase arabic:normal-case">{section.title}</h4>
            )}
            <ol className="mt-3 space-y-3">
              {section.steps.map((step, k) => {
                const index = (sectionOffsets[si] ?? 0) + k;
                const isDone = progress.done.has(step.id);
                return (
                  <li key={step.id} id={stepAnchor(index)} className="scroll-mt-24">
                    <button
                      type="button"
                      aria-pressed={isDone}
                      aria-label={`${nf.format(index + 1)}. ${t('stepDone')}`}
                      onClick={() => progress.toggleStep(step.id)}
                      className={`flex w-full items-start gap-4 rounded-card p-3 text-start transition-colors duration-200 ease-editorial ${isDone ? 'bg-olive-tint text-stone' : 'hover:bg-linen'}`}
                    >
                      <span
                        aria-hidden
                        className={`flex size-8 shrink-0 items-center justify-center rounded-pill text-ui font-semibold tabular-nums ${isDone ? 'bg-olive text-paper' : 'bg-linen text-charcoal print:bg-transparent'}`}
                      >
                        {isDone ? '✓' : nf.format(index + 1)}
                      </span>
                      <span className={`pt-1 font-serif text-body ${isDone ? 'line-through print:no-underline' : ''}`}>{step.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
