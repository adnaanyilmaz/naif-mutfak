import { describe, expect, it } from 'vitest';
import { buildOrganizationJsonLd } from './organization-jsonld';

describe('buildOrganizationJsonLd', () => {
  it('lists set profiles under sameAs', () => {
    const json = buildOrganizationJsonLd({
      name: 'Naif Mutfak',
      siteUrl: 'https://naifmutfak.com/',
      links: { instagram: 'https://www.instagram.com/naifmutfak/', youtube: null, tiktok: 'https://www.tiktok.com/@naifmutfak' },
    });
    expect(JSON.parse(json)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Naif Mutfak',
      url: 'https://naifmutfak.com/',
      sameAs: ['https://www.instagram.com/naifmutfak/', 'https://www.tiktok.com/@naifmutfak'],
    });
  });

  it('omits sameAs when no profile is set', () => {
    const json = buildOrganizationJsonLd({ name: 'N', siteUrl: 'https://x.test', links: { instagram: null, youtube: null, tiktok: null } });
    expect(JSON.parse(json)).not.toHaveProperty('sameAs');
  });
});
