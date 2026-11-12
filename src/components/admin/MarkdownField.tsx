'use client';

import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { useTranslations } from 'next-intl';
import { Fragment as ReactFragment, useDeferredValue, useMemo, useRef, useState } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { ebookDirectiveSchema, parseMarkdown } from '@/services/content/markdown';

interface MarkdownFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir: 'ltr' | 'rtl';
  lang: string;
  /** E-book slugs offered by the `::ebook` picker. */
  ebookSlugs: string[];
  rows?: number;
}

type Insert = { before: string; after?: string; placeholder?: string; block?: boolean };

/** Markdown textarea with a small toolbar and a live preview through the public remark pipeline (no eval). */
export function MarkdownField({ id, label, value, onChange, dir, lang, ebookSlugs, rows = 14 }: MarkdownFieldProps) {
  const t = useTranslations('Admin.editor');
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const deferred = useDeferredValue(value);
  const parsed = useMemo(() => (preview ? parseMarkdown(deferred) : null), [preview, deferred]);

  function insert({ before, after = '', placeholder = '', block = false }: Insert) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const lead = block && start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
    const next = `${value.slice(0, start)}${lead}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + lead.length + before.length;
      el?.setSelectionRange(caret, caret + selected.length);
    });
  }

  const tools: { key: 'h2' | 'h3' | 'bold' | 'link' | 'image'; insert: Insert }[] = [
    { key: 'h2', insert: { before: '## ', placeholder: '…', block: true } },
    { key: 'h3', insert: { before: '### ', placeholder: '…', block: true } },
    { key: 'bold', insert: { before: '**', after: '**', placeholder: '…' } },
    { key: 'link', insert: { before: '[', after: '](https://)', placeholder: '…' } },
    { key: 'image', insert: { before: '![', after: '](https://)', placeholder: 'alt' } },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={label}>
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              onClick={() => insert(tool.insert)}
              className="rounded-card border border-hairline bg-paper px-2 py-1 text-eyebrow hover:bg-linen"
            >
              {t(`toolbar.${tool.key}`)}
            </button>
          ))}
          {ebookSlugs.length > 0 ? (
            <select
              aria-label={t('toolbar.ebook')}
              value=""
              onChange={(e) => {
                if (e.target.value) insert({ before: `::ebook{product="${e.target.value}"}\n`, block: true });
              }}
              className="rounded-card border border-hairline bg-paper px-2 py-1 text-eyebrow"
            >
              <option value="">{t('toolbar.ebook')}</option>
              {ebookSlugs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
            className="rounded-card border border-hairline bg-paper px-2 py-1 text-eyebrow hover:bg-linen"
          >
            {preview ? t('hidePreview') : t('preview')}
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        id={id}
        dir={dir}
        lang={lang}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-card border border-hairline bg-paper p-3 font-mono text-[0.875rem] leading-relaxed"
      />
      {parsed ? (
        <div dir={dir} lang={lang} className="prose-editorial mt-3 max-h-[32rem] overflow-y-auto rounded-card border border-dashed border-hairline bg-paper p-4">
          {parsed.tree.children.map((child, i) => {
            if (child.type === 'element' && child.tagName === 'aside') {
              const d = ebookDirectiveSchema.safeParse({
                product: child.properties.dataEbookProduct,
                variant: child.properties.dataEbookVariant,
              });
              return (
                <p key={i} className="rounded-card border-s-4 border-terracotta bg-terracotta-tint px-3 py-2 text-ui">
                  {t('previewEbook', { product: d.success ? `${d.data.product} (${d.data.variant})` : '?' })}
                </p>
              );
            }
            return <ReactFragment key={i}>{toJsxRuntime({ type: 'root', children: [child] }, { Fragment, jsx, jsxs })}</ReactFragment>;
          })}
        </div>
      ) : null}
    </div>
  );
}
