import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import tr from '../../../messages/tr.json';
import { CATEGORIES, CATEGORY_KEYS, categoriesWithPosts, findCategory } from './category';

describe('categories', () => {
  it('defines 12 unique url-safe slugs in order', () => {
    expect(CATEGORY_KEYS).toHaveLength(12);
    expect(new Set(CATEGORY_KEYS).size).toBe(12);
    for (const k of CATEGORY_KEYS) expect(k).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(CATEGORIES.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CATEGORIES[0]?.slug).toBe('ekmekler');
    expect(CATEGORIES[11]?.slug).toBe('icecekler');
  });

  it('resolves known slugs and rejects retired or unknown values', () => {
    expect(findCategory('tatlilar')).toBe('tatlilar');
    expect(findCategory('bread')).toBeNull();
    expect(findCategory('other')).toBeNull();
  });

  it('hides empty categories and keeps display order', () => {
    const counts = [
      { category: 'tatlilar', count: 2 },
      { category: 'ekmekler', count: 1 },
      { category: 'kekler', count: 0 },
      { category: 'bread', count: 4 },
    ];
    expect(categoriesWithPosts(counts)).toEqual(['ekmekler', 'tatlilar']);
  });

  it('has a Turkish label for every category and a key in every locale', () => {
    for (const k of CATEGORY_KEYS) {
      expect(tr.Categories[k]).not.toBe('');
      expect(typeof en.Categories[k]).toBe('string');
      expect(typeof ar.Categories[k]).toBe('string');
    }
    expect(Object.keys(tr.Categories).sort()).toEqual([...CATEGORY_KEYS].sort());
  });
});
