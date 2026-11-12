'use client';

import { useTranslations } from 'next-intl';
import { LOCALE_META } from '@/i18n/config';
import { autoSlug } from '@/services/admin/post-form';
import type { TranslationForm } from '@/validators/admin/post-form';
import type { Locale } from '@/validators/content';
import { CheckboxField, TextField } from './fields';
import { IngredientsEditor } from './IngredientsEditor';
import { InstructionsEditor } from './InstructionsEditor';
import { MarkdownField } from './MarkdownField';

interface TranslationPaneProps {
  postId: string;
  locale: Locale;
  value: TranslationForm | null;
  isRecipe: boolean;
  mediaBaseUrl: string;
  ebookSlugs: string[];
  /** Issues for this locale keyed by field. */
  fieldErrors: Partial<Record<string, string>>;
  slugStatus: 'ok' | 'invalid' | 'taken' | null;
  slugTouched: boolean;
  canCopyStructure: boolean;
  onChange: (next: TranslationForm) => void;
  onStart: () => void;
  onCopyStructure: () => void;
  onSlugEdited: () => void;
  onSlugBlur: () => void;
}

export function TranslationPane(props: TranslationPaneProps) {
  const t = useTranslations('Admin.editor');
  const { value, locale } = props;
  const meta = LOCALE_META[locale];

  if (!value) {
    return (
      <section lang={locale} dir={meta.dir} data-script={meta.script} className="rounded-card border border-dashed border-hairline bg-paper p-6 text-center">
        <p className="text-stone">{t('notStarted')}</p>
        <button type="button" onClick={props.onStart} className="mt-3 rounded-pill bg-charcoal px-4 py-2 text-white">
          {t('startTranslation')}
        </button>
      </section>
    );
  }

  const set = <K extends keyof TranslationForm>(key: K, v: TranslationForm[K]) => props.onChange({ ...value, [key]: v });
  const fieldProps = { dir: meta.dir, lang: locale };
  const err = (field: string) => props.fieldErrors[field];

  return (
    <section lang={locale} dir={meta.dir} data-script={meta.script} className="space-y-5 rounded-2xl border border-hairline bg-white p-4 md:p-5">
      <TextField
        label={t('title')}
        value={value.title}
        error={err('title')}
        {...fieldProps}
        onChange={(title) => props.onChange({ ...value, title, slug: props.slugTouched ? value.slug : autoSlug(title, locale) })}
      />
      <TextField
        label={t('slug')}
        value={value.slug}
        dir="ltr"
        hint={value.slug ? t('urlPreview', { url: `/${locale}/blog/${value.slug}` }) : undefined}
        error={
          props.slugStatus === 'taken' ? t('slugTaken') : props.slugStatus === 'invalid' ? t('slugInvalid') : err('slug')
        }
        onChange={(slug) => {
          props.onSlugEdited();
          set('slug', slug);
        }}
        onBlur={props.onSlugBlur}
      />
      <TextField label={t('dek')} value={value.dek} error={err('dek')} multiline {...fieldProps} onChange={(v) => set('dek', v)} />
      <MarkdownField
        id={`body-${locale}`}
        label={t('body')}
        value={value.bodyMd}
        onChange={(v) => set('bodyMd', v)}
        ebookSlugs={props.ebookSlugs}
        {...fieldProps}
      />
      {err('bodyMd') ? <p className="text-eyebrow text-danger">{err('bodyMd')}</p> : null}

      {props.isRecipe ? (
        <>
          {props.canCopyStructure ? (
            <div className="rounded-card bg-linen p-3">
              <button type="button" onClick={props.onCopyStructure} className="font-medium text-terracotta underline-offset-4 hover:underline">
                {t('copyStructure')}
              </button>
              <p className="text-eyebrow text-muted">{t('copyStructureHint')}</p>
            </div>
          ) : null}
          <IngredientsEditor groups={value.ingredients} onChange={(g) => set('ingredients', g)} {...fieldProps} />
          {err('ingredients') ? <p className="text-eyebrow text-danger">{err('ingredients')}</p> : null}
          <InstructionsEditor
            postId={props.postId}
            sections={value.instructions}
            onChange={(s) => set('instructions', s)}
            mediaBaseUrl={props.mediaBaseUrl}
            {...fieldProps}
          />
          {err('instructions') ? <p className="text-eyebrow text-danger">{err('instructions')}</p> : null}
          <TextField label={t('cuisine')} value={value.cuisine} {...fieldProps} onChange={(v) => set('cuisine', v)} />
        </>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label={t('seoTitle')}
          value={value.seoTitle}
          maxLength={120}
          hint={t('charCount', { count: value.seoTitle.length, max: 60 })}
          {...fieldProps}
          onChange={(v) => set('seoTitle', v)}
        />
        <TextField label={t('heroAlt')} value={value.heroImageAlt} {...fieldProps} onChange={(v) => set('heroImageAlt', v)} />
      </div>
      <TextField
        label={t('seoDescription')}
        value={value.seoDescription}
        maxLength={320}
        hint={t('charCount', { count: value.seoDescription.length, max: 160 })}
        multiline
        {...fieldProps}
        onChange={(v) => set('seoDescription', v)}
      />
      <TextField label={t('keywords')} hint={t('keywordsHint')} value={value.keywords} {...fieldProps} onChange={(v) => set('keywords', v)} />
      {err('jsonLd') ? <p className="text-eyebrow text-danger">{err('jsonLd')}</p> : null}
      <CheckboxField label={t('publishedIn')} checked={value.isPublished} onChange={(v) => set('isPublished', v)} />
    </section>
  );
}
