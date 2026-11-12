'use client';

import { useTranslations } from 'next-intl';
import { emptyStep, newId } from '@/services/admin/post-form';
import { mediaUrl } from '@/services/media/image-url';
import type { SectionForm, StepForm } from '@/validators/admin/post-form';
import { IconButton, moveItem, removeAt, replaceAt } from './fields';
import { UploadButton } from './UploadButton';

interface InstructionsEditorProps {
  postId: string;
  sections: SectionForm[];
  onChange: (sections: SectionForm[]) => void;
  dir: 'ltr' | 'rtl';
  lang: string;
  mediaBaseUrl: string;
}

const cell = 'w-full rounded-card border border-hairline bg-paper px-2 py-1.5';

export function InstructionsEditor({ postId, sections, onChange, dir, lang, mediaBaseUrl }: InstructionsEditorProps) {
  const t = useTranslations('Admin');
  const setSection = (si: number, s: SectionForm) => onChange(replaceAt(sections, si, s));
  const setStep = (si: number, sti: number, patch: Partial<StepForm>) => {
    const s = sections[si];
    const step = s?.steps[sti];
    if (!s || !step) return;
    setSection(si, { ...s, steps: replaceAt(s.steps, sti, { ...step, ...patch }) });
  };
  const offsets = sections.map((_, i) => sections.slice(0, i).reduce((sum, sec) => sum + sec.steps.length, 0));

  return (
    <fieldset className="space-y-4">
      <legend className="font-display text-h3">{t('editor.instructions')}</legend>
      {sections.map((s, si) => (
        <div key={s.key} className="rounded-card border border-hairline bg-cream p-3">
          <div className="flex items-center gap-2">
            <input
              aria-label={t('editor.sectionTitle')}
              placeholder={t('editor.sectionTitle')}
              value={s.title}
              dir={dir}
              lang={lang}
              onChange={(e) => setSection(si, { ...s, title: e.target.value })}
              className={`${cell} font-medium`}
            />
            <IconButton label={t('common.moveUp')} onClick={() => onChange(moveItem(sections, si, -1))} disabled={si === 0}>
              ↑
            </IconButton>
            <IconButton label={t('common.moveDown')} onClick={() => onChange(moveItem(sections, si, 1))} disabled={si === sections.length - 1}>
              ↓
            </IconButton>
            <IconButton label={t('common.remove')} onClick={() => onChange(removeAt(sections, si))}>
              ×
            </IconButton>
          </div>
          <ol className="mt-3 space-y-3">
            {s.steps.map((step, sti) => {
              const label = t('editor.stepText', { n: (offsets[si] ?? 0) + sti + 1 });
              return (
                <li key={step.id} className="rounded-card border border-hairline bg-paper p-3">
                  <div className="flex items-start gap-2">
                    <textarea
                      aria-label={label}
                      placeholder={label}
                      value={step.text}
                      dir={dir}
                      lang={lang}
                      rows={3}
                      onChange={(e) => setStep(si, sti, { text: e.target.value })}
                      className={cell}
                    />
                    <span className="flex flex-col gap-1">
                      <IconButton label={t('common.moveUp')} onClick={() => setSection(si, { ...s, steps: moveItem(s.steps, sti, -1) })} disabled={sti === 0}>
                        ↑
                      </IconButton>
                      <IconButton
                        label={t('common.moveDown')}
                        onClick={() => setSection(si, { ...s, steps: moveItem(s.steps, sti, 1) })}
                        disabled={sti === s.steps.length - 1}
                      >
                        ↓
                      </IconButton>
                      <IconButton label={t('common.remove')} onClick={() => setSection(si, { ...s, steps: removeAt(s.steps, sti) })}>
                        ×
                      </IconButton>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2">
                      <span className="text-eyebrow text-muted">{t('editor.timer')}</span>
                      <input
                        value={step.timerMinutes}
                        inputMode="decimal"
                        dir="ltr"
                        onChange={(e) => setStep(si, sti, { timerMinutes: e.target.value })}
                        className="w-20 rounded-card border border-hairline bg-paper px-2 py-1"
                      />
                    </label>
                    {step.imageKey ? (
                      <span className="inline-flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an R2 original */}
                        <img src={mediaUrl(mediaBaseUrl, step.imageKey)} alt="" className="size-12 rounded-card object-cover" />
                        <button type="button" onClick={() => setStep(si, sti, { imageKey: null })} className="text-eyebrow text-danger">
                          {t('editor.removeImage')}
                        </button>
                      </span>
                    ) : null}
                    <UploadButton
                      kind="step_image"
                      entityId={postId}
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      label={step.imageKey ? t('common.replace') : t('editor.stepImage')}
                      onUploaded={(key) => setStep(si, sti, { imageKey: key })}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={() => setSection(si, { ...s, steps: [...s.steps, emptyStep()] })}
            className="mt-2 text-terracotta underline-offset-4 hover:underline"
          >
            + {t('editor.addStep')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...sections, { key: newId(), title: '', steps: [emptyStep()] }])}
        className="rounded-pill border border-hairline bg-paper px-3 py-1.5 hover:bg-linen"
      >
        + {t('editor.addSection')}
      </button>
    </fieldset>
  );
}
