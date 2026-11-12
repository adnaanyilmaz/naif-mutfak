import type { Root as HastRoot } from 'hast';
import type { Nodes as MdastNodes, Parent as MdastParent, Root as MdastRoot, RootContent } from 'mdast';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { z } from 'zod';

/**
 * Markdown → hast, Workers-safe (no eval / new Function / MDX).
 * Supports the leaf directive `::ebook{product="slug" variant="full|compact|inline"}`,
 * rendered as `<aside data-ebook-product data-ebook-variant>` and resolved to a component by the renderer.
 * Raw HTML is dropped; unsafe link protocols are stripped.
 */

export const EBOOK_VARIANTS = ['full', 'compact', 'inline'] as const;
export type EbookCalloutVariant = (typeof EBOOK_VARIANTS)[number];

export const ebookDirectiveSchema = z.object({
  product: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  variant: z.enum(EBOOK_VARIANTS).default('full'),
});

export interface EbookRef {
  product: string;
  variant: EbookCalloutVariant;
}

export interface ParsedMarkdown {
  tree: HastRoot;
  /** Callouts in document order (after the one-`full`-per-article rule). */
  ebooks: EbookRef[];
}

const SAFE_URL = /^(?:https?:|mailto:|\/(?!\/)|#|\.{0,2}\/)/i;

export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return false;
  // Relative paths without a scheme are safe (no ':' before the first '/', '?' or '#').
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  return SAFE_URL.test(trimmed);
}

function textOf(node: MdastNodes): string {
  if ('value' in node) return node.value;
  if ('children' in node) return node.children.map((c: MdastNodes) => textOf(c)).join('');
  return '';
}

function transformDirectives(tree: MdastRoot, ebooks: EbookRef[]): void {
  let hasFull = false;

  const walk = (parent: MdastParent): void => {
    const next: RootContent[] = [];
    for (const child of parent.children) {
      if (child.type === 'leafDirective' && child.name === 'ebook') {
        const parsed = ebookDirectiveSchema.safeParse(child.attributes ?? {});
        if (!parsed.success) continue; // invalid directive → dropped
        let variant = parsed.data.variant;
        if (variant === 'full') {
          if (hasFull) variant = 'compact'; // max one full callout per article
          hasFull = true;
        }
        ebooks.push({ product: parsed.data.product, variant });
        child.children = [];
        child.data = {
          hName: 'aside',
          hProperties: { dataEbookProduct: parsed.data.product, dataEbookVariant: variant },
        };
        next.push(child);
        continue;
      }
      if (child.type === 'leafDirective' || child.type === 'containerDirective') {
        // Unknown block directives: keep their content as plain paragraphs, drop the directive itself.
        if (child.type === 'containerDirective') {
          walk(child);
          next.push(...child.children);
        }
        continue;
      }
      if (child.type === 'textDirective') {
        // "Text:like" is parsed as a directive; restore the literal text.
        next.push({ type: 'text', value: `:${child.name}${textOf(child)}` });
        continue;
      }
      if ((child.type === 'link' || child.type === 'image') && !isSafeUrl(child.url)) {
        if (child.type === 'link') next.push(...child.children);
        continue;
      }
      if ('children' in child) walk(child);
      next.push(child);
    }
    parent.children = next;
  };

  walk(tree);
}

const processor = unified().use(remarkParse).use(remarkDirective).use(remarkRehype, { allowDangerousHtml: false });

export function parseMarkdown(markdown: string): ParsedMarkdown {
  const mdast = processor.parse(markdown);
  const ebooks: EbookRef[] = [];
  transformDirectives(mdast, ebooks);
  const tree: HastRoot = processor.runSync(mdast);
  return { tree, ebooks };
}

/** Unique product slugs referenced by callouts. */
export function ebookSlugs(parsed: ParsedMarkdown): string[] {
  return [...new Set(parsed.ebooks.map((e) => e.product))];
}
