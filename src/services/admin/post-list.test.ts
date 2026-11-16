import { describe, expect, it } from 'vitest';
import { filterAdminPosts, publicPathOf, type AdminPostListView } from './posts-admin.service';

const row = (over: Partial<AdminPostListView>): AdminPostListView => ({
  id: 'x',
  status: 'published',
  category: 'ekmekler',
  updatedAt: new Date(0),
  title: '',
  thumbnailUrl: null,
  locales: [],
  publicPath: null,
  ...over,
});

describe('filterAdminPosts', () => {
  const posts = [
    row({ id: '1', title: 'Ekşi Mayalı Köy Ekmeği', status: 'published' }),
    row({ id: '2', title: 'Antep Fıstıklı Baklava', status: 'draft' }),
  ];

  it('matches titles case- and diacritic-insensitively (Turkish)', () => {
    expect(filterAdminPosts(posts, { q: 'eksi' }).map((p) => p.id)).toEqual(['1']);
    expect(filterAdminPosts(posts, { q: 'FISTIK' }).map((p) => p.id)).toEqual(['2']);
    expect(filterAdminPosts(posts, { q: '  ' })).toHaveLength(2);
  });

  it('filters by status and combines with search', () => {
    expect(filterAdminPosts(posts, { status: 'draft' }).map((p) => p.id)).toEqual(['2']);
    expect(filterAdminPosts(posts, { status: 'draft', q: 'ekmek' })).toEqual([]);
  });
});

describe('publicPathOf', () => {
  it('returns the first published locale in tr → en → ar order', () => {
    const translations = [
      { locale: 'ar' as const, slug: 'baklawa', isPublished: true },
      { locale: 'tr' as const, slug: 'baklava', isPublished: false },
      { locale: 'en' as const, slug: 'pistachio-baklava', isPublished: true },
    ];
    expect(publicPathOf('published', translations)).toBe('/en/blog/pistachio-baklava');
  });

  it('is null for unpublished posts or when no locale is live', () => {
    expect(publicPathOf('draft', [{ locale: 'tr', slug: 'a', isPublished: true }])).toBeNull();
    expect(publicPathOf('published', [{ locale: 'tr', slug: 'a', isPublished: false }])).toBeNull();
  });
});
