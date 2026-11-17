import { describe, expect, it, vi } from 'vitest';
import type { SiteSettingsRepo } from '@/repositories/site-settings';
import { getSocialLinks, saveSocialLinks, socialProfiles } from './social.service';

function fakeRepo(stored: unknown = null): SiteSettingsRepo {
  return { get: vi.fn(async () => stored), set: vi.fn(async () => undefined) };
}

const admin = { email: 'admin@example.com' };

describe('getSocialLinks', () => {
  it('returns empty links when nothing is stored or the row is malformed', async () => {
    const empty = { instagram: null, youtube: null, tiktok: null };
    expect(await getSocialLinks({ settings: fakeRepo() })).toEqual(empty);
    expect(await getSocialLinks({ settings: fakeRepo({ instagram: 'javascript:alert(1)', youtube: null, tiktok: null }) })).toEqual(empty);
  });

  it('returns stored links', async () => {
    const stored = { instagram: 'https://www.instagram.com/naifmutfak/', youtube: null, tiktok: null };
    expect(await getSocialLinks({ settings: fakeRepo(stored) })).toEqual(stored);
  });
});

describe('saveSocialLinks', () => {
  it('normalises handles and urls, then stores them with an audit entry', async () => {
    const settings = fakeRepo();
    const result = await saveSocialLinks({ settings }, admin, { instagram: '@naifmutfak', youtube: 'https://youtube.com/@naifmutfak?si=x', tiktok: '' });
    const links = { instagram: 'https://www.instagram.com/naifmutfak/', youtube: 'https://youtube.com/@naifmutfak', tiktok: null };
    expect(result).toEqual({ ok: true, links });
    expect(settings.set).toHaveBeenCalledWith('social', links, expect.objectContaining({ entityType: 'settings', diff: { set: ['instagram', 'youtube'] } }));
  });

  it('reports every invalid platform and stores nothing', async () => {
    const settings = fakeRepo();
    const result = await saveSocialLinks({ settings }, admin, { instagram: 'https://evil.example/x', youtube: '', tiktok: 'https://www.instagram.com/x' });
    expect(result).toEqual({ ok: false, invalid: ['instagram', 'tiktok'] });
    expect(settings.set).not.toHaveBeenCalled();
  });
});

describe('socialProfiles', () => {
  it('lists set profiles in display order', () => {
    expect(socialProfiles({ instagram: null, youtube: 'https://www.youtube.com/@a', tiktok: 'https://www.tiktok.com/@a' })).toEqual([
      { platform: 'youtube', url: 'https://www.youtube.com/@a' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@a' },
    ]);
  });
});
