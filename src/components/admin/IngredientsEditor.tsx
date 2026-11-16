'use client';

import { useTranslations } from 'next-intl';
import { emptyIngredientRow, newId } from '@/services/admin/post-form';
import type { IngredientGroupForm, IngredientRow } from '@/validators/admin/post-form';
import { IconButton, moveItem, removeAt, replaceAt } from './fields';

interface IngredientsEditorProps {
  groups: IngredientGroupForm[];
  onChange: (groups: IngredientGroupForm[]) => void;
  dir: 'ltr' | 'rtl';
  lang: string;
}

const cell = 'w-full min-w-0 rounded-card border border-hairline bg-paper px-3 py-2 md:px-2 md:py-1.5';
const mobileLabel = 'mb-1 block text-eyebrow text-muted md:hidden';
/** Desktop column template shared by the header row and every ingredient row. */
const COLS = 'md:grid-cols-[5rem_5rem_5rem_5rem_1fr_1fr_4rem_7rem] md:items-center md:gap-2';
const NUMERIC = [
  ['quantity', 'qty'],
  ['quantityMax', 'qtyMax'],
  ['unit', 'unit'],
  ['unitGrams', 'grams'],
] as const;

export function IngredientsEditor({ groups, onChange, dir, lang }: IngredientsEditorProps) {
  const t = useTranslations('Admin');

  const setGroup = (gi: number, g: IngredientGroupForm) => onChange(replaceAt(groups, gi, g));
  const setRow = (gi: number, ri: number, patch: Partial<IngredientRow>) => {
    const g = groups[gi];
    if (!g) return;
    const row = g.items[ri];
    if (!row) return;
    setGroup(gi, { ...g, items: replaceAt(g.items, ri, { ...row, ...patch }) });
  };

  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="font-display text-h3">{t('editor.ingredients')}</legend>
      {groups.map((g, gi) => (
        <div key={g.key} className="rounded-card border border-hairline bg-cream p-3">
          <div className="flex items-center gap-2">
            <input
              aria-label={t('editor.groupTitle')}
              placeholder={t('editor.groupTitle')}
              value={g.title}
              dir={dir}
              lang={lang}
              onChange={(e) => setGroup(gi, { ...g, title: e.target.value })}
              className={`${cell} font-medium`}
            />
            <IconButton label={t('common.moveUp')} onClick={() => onChange(moveItem(groups, gi, -1))} disabled={gi === 0}>
              ↑
            </IconButton>
            <IconButton label={t('common.moveDown')} onClick={() => onChange(moveItem(groups, gi, 1))} disabled={gi === groups.length - 1}>
              ↓
            </IconButton>
            <IconButton label={t('common.remove')} onClick={() => onChange(removeAt(groups, gi))}>
              ×
            </IconButton>
          </div>

          {/* Phones: one stacked card per ingredient. From `md`: a spreadsheet-like grid that scrolls sideways if cramped. */}
          <div className="mt-3 md:overflow-x-auto">
            <div className="md:min-w-[46rem]">
              <div aria-hidden className={`hidden text-eyebrow text-muted md:grid ${COLS}`}>
                {NUMERIC.map(([field, key]) => (
                  <span key={field}>{t(`editor.${key}`)}</span>
                ))}
                <span>{t('editor.name')}</span>
                <span>{t('editor.note')}</span>
                <span>{t('editor.scalable')}</span>
              </div>
              <ul className="space-y-3 md:mt-1 md:space-y-2">
                {g.items.map((row, ri) => (
                  <li
                    key={row.id}
                    className={`grid grid-cols-2 gap-2 rounded-card border border-hairline bg-paper p-3 md:rounded-none md:border-0 md:bg-transparent md:p-0 ${COLS}`}
                  >
                    {NUMERIC.map(([field, key]) => (
                      <label key={field} className="block min-w-0">
                        <span className={mobileLabel}>{t(`editor.${key}`)}</span>
                        <input
                          aria-label={t(`editor.${key}`)}
                          value={row[field]}
                          inputMode={field === 'unit' ? 'text' : 'decimal'}
                          dir="ltr"
                          onChange={(e) => setRow(gi, ri, { [field]: e.target.value })}
                          className={cell}
                        />
                      </label>
                    ))}
                    {(['name', 'note'] as const).map((field) => (
                      <label key={field} className="col-span-2 block min-w-0 md:col-span-1">
                        <span className={mobileLabel}>{t(`editor.${field}`)}</span>
                        <input
                          aria-label={t(`editor.${field}`)}
                          value={row[field]}
                          dir={dir}
                          lang={lang}
                          onChange={(e) => setRow(gi, ri, { [field]: e.target.value })}
                          className={cell}
                        />
                      </label>
                    ))}
                    <div className="col-span-2 flex items-center justify-between gap-2 md:contents">
                      <label className="inline-flex min-h-10 items-center gap-2 md:min-h-0 md:justify-center">
                        <input
                          type="checkbox"
                          aria-label={t('editor.scalable')}
                          checked={row.scalable}
                          onChange={(e) => setRow(gi, ri, { scalable: e.target.checked })}
                          className="size-5 accent-terracotta md:size-4"
                        />
                        <span aria-hidden className="md:hidden">
                          {t('editor.scalable')}
                        </span>
                      </label>
                      <span className="flex gap-1">
                        <IconButton label={t('common.moveUp')} onClick={() => setGroup(gi, { ...g, items: moveItem(g.items, ri, -1) })} disabled={ri === 0}>
                          ↑
                        </IconButton>
                        <IconButton
                          label={t('common.moveDown')}
                          onClick={() => setGroup(gi, { ...g, items: moveItem(g.items, ri, 1) })}
                          disabled={ri === g.items.length - 1}
                        >
                          ↓
                        </IconButton>
                        <IconButton label={t('common.remove')} onClick={() => setGroup(gi, { ...g, items: removeAt(g.items, ri) })}>
                          ×
                        </IconButton>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGroup(gi, { ...g, items: [...g.items, emptyIngredientRow()] })}
            className="mt-2 inline-flex min-h-10 items-center text-terracotta underline-offset-4 hover:underline md:min-h-0"
          >
            + {t('editor.addIngredient')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...groups, { key: newId(), title: '', items: [emptyIngredientRow()] }])}
        className="inline-flex min-h-10 items-center rounded-pill border border-hairline bg-paper px-4 hover:bg-linen md:min-h-0 md:px-3 md:py-1.5"
      >
        + {t('editor.addGroup')}
      </button>
    </fieldset>
  );
}
