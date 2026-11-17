// Pure rules for the site's social profile links (footer + Organization JSON-LD).
export const SOCIAL_PLATFORMS = ['instagram', 'youtube', 'tiktok'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Record<SocialPlatform, string | null>;

export const EMPTY_SOCIAL_LINKS: SocialLinks = { instagram: null, youtube: null, tiktok: null };

const HOSTS: Record<SocialPlatform, readonly string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};

const HANDLE = /^@?([A-Za-z0-9._-]{1,60})$/;

function fromHandle(platform: SocialPlatform, handle: string): string {
  if (platform === 'instagram') return `https://www.instagram.com/${handle}/`;
  if (platform === 'youtube') return `https://www.youtube.com/@${handle}`;
  return `https://www.tiktok.com/@${handle}`;
}

export type NormalizedLink = { ok: true; url: string | null } | { ok: false };

/**
 * Accepts a profile URL on the platform's own domain or a bare handle (`naifmutfak`, `@naifmutfak`).
 * Returns a canonical https URL, null for an empty field, or `ok: false` for anything else.
 */
export function normalizeSocialLink(platform: SocialPlatform, input: string): NormalizedLink {
  const raw = input.trim();
  if (raw === '') return { ok: true, url: null };

  const handle = HANDLE.exec(raw)?.[1];
  if (handle) {
    // A bare platform domain ("instagram.com") is a URL without a profile, not a handle.
    if (Object.values(HOSTS).some((hosts) => hosts.includes(handle.toLowerCase()))) return { ok: false };
    return { ok: true, url: fromHandle(platform, handle) };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false };
  }
  const host = url.hostname.toLowerCase();
  if (!HOSTS[platform].includes(host) || url.pathname.replace(/\/+$/, '') === '' || url.username || url.password) {
    return { ok: false };
  }
  return { ok: true, url: `https://${host}${url.pathname}` };
}
