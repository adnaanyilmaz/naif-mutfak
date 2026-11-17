import { socialProfiles } from '@/services/settings/social.service';
import type { SocialLinks } from '@/services/settings/social-links';
import { serializeJsonLd } from './jsonld';

/** Home page `Organization` JSON-LD; `sameAs` lets search engines tie the site to its social profiles. */
export function buildOrganizationJsonLd(input: { name: string; siteUrl: string; links: SocialLinks }): string {
  const sameAs = socialProfiles(input.links).map((p) => p.url);
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: `${input.siteUrl.replace(/\/+$/, '')}/`,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  });
}
