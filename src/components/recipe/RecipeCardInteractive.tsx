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
  stepImageUrls: Record<string, string>;
}

const chip =
  'min-h-10 min-w-11 rounded-pill px-3 text-ui font-semibold tabular-nums transition-colors duration-200 ease-editorial';

export function RecipeCardInteractive({ postId, baseServings, ingredients, instructions, stepImageUrls }: RecipeCardInteractiveProps) {
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
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline p-2 ps-3 print:hidden">
        <div role="group" aria-label={t('multiplier')} className="flex flex-wrap gap-1 rounded-pill bg-linen p-1">
          {SERVING_MULTIPLIERS.map((m) => {
            const target = clampServings(baseServings * m);
            const active = servings === target;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setServings(target)}
                className={`${chip} ${active ? 'bg-white text-terracotta-deep shadow-[0_1px_3px_rgb(0_0_0/0.12)]' : 'text-stone hover:text-charcoal'}`}
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
            className={`${chip} border border-hairline bg-white hover:border-charcoal disabled:opacity-40`}
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
            className={`${chip} border border-hairline bg-white hover:border-charcoal disabled:opacity-40`}
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
          <h3 className="font-display text-h3 font-extrabold">{t('ingredients')}</h3>
          {progress.hasProgress && (
            <button type="button" onClick={progress.reset} className="text-ui text-terracotta underline underline-offset-4 print:hidden">
              {t('reset')}
            </button>
          )}
        </div>
        {groups.map((group, gi) => (
          <div key={gi} className="recipe-group mt-5">
            {group.title && <h4 className="text-[0.8125rem] font-bold text-terracotta">{group.title}</h4>}
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isChecked = progress.checked.has(item.id);
                return (
                  <li key={item.id}>
                    <label
                      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 ease-editorial ${isChecked ? 'bg-olive-tint text-muted line-through print:bg-transparent print:no-underline' : 'hover:bg-linen'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => progress.toggleIngredient(item.id)}
                        className="mt-0.5 size-5 shrink-0 accent-terracotta print:hidden"
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
        <h3 className="font-display text-h3 font-extrabold">{t('instructions')}</h3>
        {instructions.map((section, si) => (
          <div key={si} className="recipe-group mt-5">
            {section.title && (
              <h4 className="text-[0.8125rem] font-bold text-terracotta">{section.title}</h4>
            )}
            <ol className="mt-3 space-y-3">
              {section.steps.map((step, k) => {
                const index = (sectionOffsets[si] ?? 0) + k;
                const isDone = progress.done.has(step.id);
                const imageUrl = stepImageUrls[step.id];
                return (
                  <li key={step.id} id={stepAnchor(index)} className="scroll-mt-24">
                    <button
                      type="button"
                      aria-pressed={isDone}
                      aria-label={`${nf.format(index + 1)}. ${t('stepDone')}`}
                      onClick={() => progress.toggleStep(step.id)}
                      className={`flex w-full items-start gap-4 rounded-2xl p-3 text-start transition-colors duration-200 ease-editorial ${isDone ? 'bg-olive-tint text-muted' : 'hover:bg-linen'}`}
                    >
                      <span
                        aria-hidden
                        className={`flex size-8 shrink-0 items-center justify-center rounded-pill text-ui font-bold tabular-nums ${isDone ? 'bg-olive text-white' : 'bg-terracotta-tint text-terracotta-deep print:bg-transparent'}`}
                      >
                        {isDone ? '✓' : nf.format(index + 1)}
                      </span>
                      <span className={`pt-1 text-[1.0625rem] leading-relaxed ${isDone ? 'line-through print:no-underline' : ''}`}>{step.text}</span>
                    </button>
                    {imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- URLs are pre-sized by Cloudflare Image Transformations.
                      <img
                        src={imageUrl}
                        alt=""
                        width={1080}
                        height={720}
                        loading="lazy"
                        className={`mt-2 ms-15 block h-auto w-[calc(100%-3.75rem)] rounded-2xl transition-opacity duration-200 ease-editorial print:ms-0 print:w-1/2 ${isDone ? 'opacity-50' : ''}`}
                      />
                    )}
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
