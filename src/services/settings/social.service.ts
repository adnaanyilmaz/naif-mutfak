import type { SiteSettingsRepo } from '@/repositories/site-settings';
import type { AdminIdentity } from '@/services/admin/auth.service';
import { socialLinksSchema, type SocialLinksInput } from '@/validators/settings';
import { EMPTY_SOCIAL_LINKS, normalizeSocialLink, SOCIAL_PLATFORMS, type SocialLinks, type SocialPlatform } from './social-links';

export interface SocialDeps {
  settings: SiteSettingsRepo;
}

/** Never throws for bad stored data: the footer must render even if the row is missing or malformed. */
export async function getSocialLinks(deps: SocialDeps): Promise<SocialLinks> {
  const parsed = socialLinksSchema.safeParse(await deps.settings.get('social'));
  return parsed.success ? parsed.data : EMPTY_SOCIAL_LINKS;
}

/** Profile URLs that are set, in display order (footer + JSON-LD `sameAs`). */
export function socialProfiles(links: SocialLinks): { platform: SocialPlatform; url: string }[] {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const url = links[platform];
    return url ? [{ platform, url }] : [];
  });
}

export type SaveSocialLinksResult = { ok: true; links: SocialLinks } | { ok: false; invalid: SocialPlatform[] };

export async function saveSocialLinks(deps: SocialDeps, admin: Pick<AdminIdentity, 'email'>, input: SocialLinksInput): Promise<SaveSocialLinksResult> {
  const links: SocialLinks = { ...EMPTY_SOCIAL_LINKS };
  const invalid: SocialPlatform[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    const result = normalizeSocialLink(platform, input[platform]);
    if (result.ok) links[platform] = result.url;
    else invalid.push(platform);
  }
  if (invalid.length > 0) return { ok: false, invalid };

  await deps.settings.set('social', socialLinksSchema.parse(links), {
    actorEmail: admin.email,
    action: 'settings.social.update',
    entityType: 'settings',
    entityId: 'social',
    diff: { set: socialProfiles(links).map((p) => p.platform) },
  });
  return { ok: true, links };
}
