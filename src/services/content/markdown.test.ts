import type { Element, ElementContent, RootContent } from 'hast';
import { describe, expect, it } from 'vitest';
import { ebookSlugs, isSafeUrl, parseMarkdown } from './markdown';

function elements(nodes: (RootContent | ElementContent)[]): Element[] {
  return nodes.flatMap((n) => (n.type === 'element' ? [n, ...elements(n.children)] : []));
}

function asides(md: string): Element[] {
  return elements(parseMarkdown(md).tree.children).filter((e) => e.tagName === 'aside');
}

function text(nodes: (RootContent | ElementContent)[]): string {
  return nodes.map((n) => (n.type === 'text' ? n.value : n.type === 'element' ? text(n.children) : '')).join('');
}

describe('parseMarkdown — ::ebook directive', () => {
  it('turns a leaf directive into an aside carrying product and variant', () => {
    const parsed = parseMarkdown('Intro.\n\n::ebook{product="baking-at-home" variant="compact"}\n\nOutro.');
    expect(parsed.ebooks).toEqual([{ product: 'baking-at-home', variant: 'compact' }]);
    const [aside] = asides('::ebook{product="baking-at-home" variant="compact"}');
    expect(aside?.properties).toMatchObject({ dataEbookProduct: 'baking-at-home', dataEbookVariant: 'compact' });
    expect(aside?.children).toEqual([]);
  });

  it('defaults the variant to full', () => {
    expect(parseMarkdown('::ebook{product="sourdough-basics"}').ebooks).toEqual([
      { product: 'sourdough-basics', variant: 'full' },
    ]);
  });

  it('allows only one full callout per article (later ones become compact)', () => {
    const md = '::ebook{product="a"}\n\ntext\n\n::ebook{product="b"}\n\n::ebook{product="a"}';
    const parsed = parseMarkdown(md);
    expect(parsed.ebooks.map((e) => e.variant)).toEqual(['full', 'compact', 'compact']);
    expect(ebookSlugs(parsed)).toEqual(['a', 'b']);
  });

  it('drops directives with invalid attributes', () => {
    for (const md of [
      '::ebook',
      '::ebook{product=""}',
      '::ebook{product="../../etc/passwd"}',
      '::ebook{product="UPPER"}',
      '::ebook{product="ok" variant="huge"}',
    ]) {
      const parsed = parseMarkdown(md);
      expect(parsed.ebooks, md).toEqual([]);
      expect(asides(md), md).toEqual([]);
    }
  });

  it('removes unknown leaf directives and keeps container directive content', () => {
    const parsed = parseMarkdown('::video{src="x"}\n\n:::note\nInside **note**\n:::');
    expect(asides('::video{src="x"}')).toEqual([]);
    expect(text(parsed.tree.children)).toContain('Inside note');
  });

  it('restores accidental text directives as literal text', () => {
    const parsed = parseMarkdown('Ratio flour:water is 1:0.75.');
    expect(text(parsed.tree.children)).toContain('flour:water');
  });
});

describe('parseMarkdown — safety (Workers, no eval)', () => {
  it('drops raw HTML including scripts', () => {
    const parsed = parseMarkdown('Hello <script>alert(1)</script>\n\n<iframe src="x"></iframe>');
    const tags = elements(parsed.tree.children).map((e) => e.tagName);
    expect(tags).not.toContain('script');
    expect(tags).not.toContain('iframe');
    expect(JSON.stringify(parsed.tree)).not.toContain('<script');
  });

  it('strips javascript: links but keeps their text', () => {
    const parsed = parseMarkdown('[click](javascript:alert(1)) and [ok](https://example.com) and [rel](/tr/blog)');
    const links = elements(parsed.tree.children).filter((e) => e.tagName === 'a');
    expect(links.map((l) => l.properties.href)).toEqual(['https://example.com', '/tr/blog']);
    expect(text(parsed.tree.children)).toContain('click');
  });

  it('classifies URLs', () => {
    expect(isSafeUrl('https://a.b')).toBe(true);
    expect(isSafeUrl('mailto:x@y.z')).toBe(true);
    expect(isSafeUrl('#step-1')).toBe(true);
    expect(isSafeUrl('relative/path')).toBe(true);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('vbscript:x')).toBe(false);
  });

  it('renders standard markdown structure', () => {
    const tags = elements(parseMarkdown('## Title\n\n- a\n- b\n\n> quote').tree.children).map((e) => e.tagName);
    expect(tags).toEqual(expect.arrayContaining(['h2', 'ul', 'li', 'blockquote']));
  });
});
