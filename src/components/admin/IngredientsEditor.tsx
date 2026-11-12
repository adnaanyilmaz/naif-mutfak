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

const cell = 'w-full rounded-card border border-hairline bg-paper px-2 py-1.5';

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
    <fieldset className="space-y-4">
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

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-ui">
              <thead className="text-eyebrow text-muted">
                <tr>
                  <th className="w-20 px-1 text-start font-normal">{t('editor.qty')}</th>
                  <th className="w-20 px-1 text-start font-normal">{t('editor.qtyMax')}</th>
                  <th className="w-20 px-1 text-start font-normal">{t('editor.unit')}</th>
                  <th className="w-20 px-1 text-start font-normal">{t('editor.grams')}</th>
                  <th className="px-1 text-start font-normal">{t('editor.name')}</th>
                  <th className="px-1 text-start font-normal">{t('editor.note')}</th>
                  <th className="w-16 px-1 text-start font-normal">{t('editor.scalable')}</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {g.items.map((row, ri) => (
                  <tr key={row.id}>
                    {(['quantity', 'quantityMax', 'unit', 'unitGrams'] as const).map((field) => (
                      <td key={field} className="px-1 py-1">
                        <input
                          aria-label={t(`editor.${field === 'quantity' ? 'qty' : field === 'quantityMax' ? 'qtyMax' : field === 'unit' ? 'unit' : 'grams'}`)}
                          value={row[field]}
                          inputMode={field === 'unit' ? 'text' : 'decimal'}
                          dir="ltr"
                          onChange={(e) => setRow(gi, ri, { [field]: e.target.value })}
                          className={cell}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <input
                        aria-label={t('editor.name')}
                        value={row.name}
                        dir={dir}
                        lang={lang}
                        onChange={(e) => setRow(gi, ri, { name: e.target.value })}
                        className={cell}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        aria-label={t('editor.note')}
                        value={row.note}
                        dir={dir}
                        lang={lang}
                        onChange={(e) => setRow(gi, ri, { note: e.target.value })}
                        className={cell}
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        aria-label={t('editor.scalable')}
                        checked={row.scalable}
                        onChange={(e) => setRow(gi, ri, { scalable: e.target.checked })}
                        className="size-4 accent-terracotta"
                      />
                    </td>
                    <td className="px-1 py-1">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setGroup(gi, { ...g, items: [...g.items, emptyIngredientRow()] })}
            className="mt-2 text-terracotta underline-offset-4 hover:underline"
          >
            + {t('editor.addIngredient')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...groups, { key: newId(), title: '', items: [emptyIngredientRow()] }])}
        className="rounded-pill border border-hairline bg-paper px-3 py-1.5 hover:bg-linen"
      >
        + {t('editor.addGroup')}
      </button>
    </fieldset>
  );
}
