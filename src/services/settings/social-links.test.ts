import { describe, expect, it } from 'vitest';
import { normalizeSocialLink } from './social-links';

describe('normalizeSocialLink', () => {
  it('treats an empty field as no link', () => {
    expect(normalizeSocialLink('instagram', '   ')).toEqual({ ok: true, url: null });
  });

  it.each([
    ['instagram', 'naifmutfak', 'https://www.instagram.com/naifmutfak/'],
    ['instagram', '@naif.mutfak', 'https://www.instagram.com/naif.mutfak/'],
    ['instagram', 'naif.mutfak', 'https://www.instagram.com/naif.mutfak/'],
    ['youtube', '@NaifMutfak', 'https://www.youtube.com/@NaifMutfak'],
    ['tiktok', 'naif_mutfak', 'https://www.tiktok.com/@naif_mutfak'],
  ] as const)('builds %s profile urls from the handle %s', (platform, input, url) => {
    expect(normalizeSocialLink(platform, input)).toEqual({ ok: true, url });
  });

  it.each([
    ['instagram', 'https://www.instagram.com/naifmutfak/?hl=tr', 'https://www.instagram.com/naifmutfak/'],
    ['instagram', 'instagram.com/naifmutfak', 'https://instagram.com/naifmutfak'],
    ['youtube', 'http://youtube.com/@naifmutfak#about', 'https://youtube.com/@naifmutfak'],
    ['youtube', 'https://www.youtube.com/channel/UC1234567890', 'https://www.youtube.com/channel/UC1234567890'],
    ['tiktok', 'https://www.tiktok.com/@naifmutfak?lang=tr', 'https://www.tiktok.com/@naifmutfak'],
  ] as const)('canonicalises %s url %s', (platform, input, url) => {
    expect(normalizeSocialLink(platform, input)).toEqual({ ok: true, url });
  });

  it.each([
    ['instagram', 'https://evil.example/naifmutfak'],
    ['instagram', 'https://www.tiktok.com/@naifmutfak'],
    ['youtube', 'https://www.youtube.com/'],
    ['instagram', 'instagram.com'],
    ['tiktok', 'javascript:alert(1)'],
    ['tiktok', 'https://user:pass@www.tiktok.com/@x'],
    ['instagram', 'iki kelime'],
  ] as const)('rejects %s input %s', (platform, input) => {
    expect(normalizeSocialLink(platform, input)).toEqual({ ok: false });
  });
});
