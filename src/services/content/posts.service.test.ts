import { describe, expect, it, vi } from 'vitest';
import type { PostDetail, PostsRepo, PostSummary } from '@/repositories/posts';
import { categoryPath, listActiveCategories, listPosts, toRecipe, type ContentDeps } from './posts.service';

const summary: PostSummary = {
  id: 'p1',
  locale: 'tr',
  slug: 'koy-ekmegi',
  title: 'Köy Ekmeği',
  dek: null,
  category: 'ekmekler',
  heroImageKey: null,
  heroImageAlt: null,
  isRecipe: true,
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  prepMinutes: 20,
  cookMinutes: 40,
  restMinutes: null,
  difficulty: 'easy',
};

function fakeRepo(counts: Array<{ category: string; count: number }> = []): PostsRepo {
  return {
    listPublished: vi.fn(async () => [summary]),
    countPublishedByCategory: vi.fn(async () => counts),
    findPublishedBySlug: vi.fn(async () => null),
    listPublishedAlternates: vi.fn(async () => []),
  };
}

function deps(posts: PostsRepo): Pick<ContentDeps, 'posts' | 'mediaBaseUrl'> {
  return { posts, mediaBaseUrl: 'https://media.example' };
}

describe('listPosts', () => {
  it('passes the category filter to the repository', async () => {
    const posts = fakeRepo();
    const cards = await listPosts(deps(posts), 'tr', { category: 'ekmekler' });
    expect(posts.listPublished).toHaveBeenCalledWith('tr', { limit: 12, offset: 0, category: 'ekmekler' });
    expect(cards[0]).toMatchObject({ slug: 'koy-ekmegi', category: 'ekmekler', totalMinutes: 60 });
  });

  it('lists every category when no filter is given', async () => {
    const posts = fakeRepo();
    await listPosts(deps(posts), 'tr');
    expect(posts.listPublished).toHaveBeenCalledWith('tr', { limit: 12, offset: 0 });
  });
});

describe('listActiveCategories', () => {
  it('returns only categories with published posts, in display order', async () => {
    const posts = fakeRepo([
      { category: 'tatlilar', count: 1 },
      { category: 'ekmekler', count: 2 },
      { category: 'legacy', count: 3 },
    ]);
    expect(await listActiveCategories(deps(posts), 'tr')).toEqual(['ekmekler', 'tatlilar']);
  });
});

describe('toRecipe', () => {
  const detail: PostDetail = {
    ...summary,
    bodyMd: '',
    seoTitle: null,
    seoDescription: null,
    ingredients: [{ items: [{ id: 'i1', quantity: 500, unit: 'g', name: 'Un', scalable: true }] }],
    instructions: [
      {
        steps: [
          { id: 's1', text: 'Yoğurun.', imageKey: 'posts/p1/step one.jpg' },
          { id: 's2', text: 'Pişirin.' },
        ],
      },
    ],
    keywords: null,
    cuisine: null,
    baseServings: 4,
    featuredProductId: null,
    youtubeVideoId: null,
    videoMode: 'button',
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };

  it('exposes the video only when an id is set', () => {
    expect(toRecipe(detail, 'https://media.example')?.video).toBeNull();
    expect(toRecipe({ ...detail, youtubeVideoId: 'dQw4w9WgXcQ', videoMode: 'auto' }, 'https://media.example')?.video).toEqual({
      youtubeId: 'dQw4w9WgXcQ',
      mode: 'auto',
    });
  });

  it('maps step images to sized public urls, keyed by step id', () => {
    const recipe = toRecipe(detail, 'https://media.example/');
    expect(recipe?.stepImageUrls).toEqual({
      s1: 'https://media.example/cdn-cgi/image/width=1080,format=auto/posts/p1/step%20one.jpg',
    });
  });

  it('returns null for non-recipes', () => {
    expect(toRecipe({ ...detail, isRecipe: false }, 'https://media.example')).toBeNull();
  });
});

describe('categoryPath', () => {
  it('builds the localized category url', () => {
    expect(categoryPath('ar', 'borek-katmer')).toBe('/ar/blog/kategori/borek-katmer');
  });
});
