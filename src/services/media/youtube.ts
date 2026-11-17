/** YouTube video ids are 11 chars of URL-safe base64. */
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const PATH_PREFIXES = ['/embed/', '/shorts/', '/live/', '/v/'];

/** Extracts the video id from a pasted YouTube link (or a bare id). Returns null when it is not one. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (YOUTUBE_ID_PATTERN.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (HOSTS.has(host)) {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v');
    else {
      const prefix = PATH_PREFIXES.find((p) => url.pathname.startsWith(p));
      if (prefix) candidate = url.pathname.slice(prefix.length).split('/')[0] ?? null;
    }
  }
  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

export function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Privacy-enhanced embed that starts playing as soon as it loads. Muted autoplay is the only kind browsers allow without a click. */
export function youTubeEmbedUrl(id: string, opts: { muted: boolean }): string {
  const params = new URLSearchParams({ autoplay: '1', mute: opts.muted ? '1' : '0', playsinline: '1', rel: '0' });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}
