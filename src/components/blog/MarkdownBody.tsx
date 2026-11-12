import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment as ReactFragment } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { EbookCallout } from '@/components/commerce/EbookCallout';
import type { EbookView } from '@/services/catalog/catalog.service';
import { ebookDirectiveSchema, type ParsedMarkdown } from '@/services/content/markdown';

interface MarkdownBodyProps {
  parsed: ParsedMarkdown;
  /** Callout products resolved by the service, keyed by slug. */
  ebooks?: Record<string, EbookView>;
  className?: string;
}

/**
 * Renders the service-parsed hast tree (no eval). Top-level `::ebook` directives arrive as
 * `<aside data-ebook-product data-ebook-variant>` and are swapped for the EbookCallout component.
 */
export function MarkdownBody({ parsed, ebooks = {}, className = '' }: MarkdownBodyProps) {
  return (
    <div className={`prose-editorial ${className}`}>
      {parsed.tree.children.map((child, i) => {
        if (child.type === 'element' && child.tagName === 'aside') {
          const directive = ebookDirectiveSchema.safeParse({
            product: child.properties.dataEbookProduct,
            variant: child.properties.dataEbookVariant,
          });
          const ebook = directive.success ? ebooks[directive.data.product] : undefined;
          return directive.success && ebook ? (
            <EbookCallout key={i} ebook={ebook} variant={directive.data.variant} />
          ) : null;
        }
        return (
          <ReactFragment key={i}>{toJsxRuntime({ type: 'root', children: [child] }, { Fragment, jsx, jsxs })}</ReactFragment>
        );
      })}
    </div>
  );
}
