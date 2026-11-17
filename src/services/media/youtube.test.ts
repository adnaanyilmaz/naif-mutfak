import { describe, expect, it } from 'vitest';
import { parseYouTubeId, youTubeEmbedUrl, youTubeWatchUrl } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it.each([
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?feature=share&v=${ID}&t=42`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`,
    `https://www.youtube.com/live/${ID}`,
    `  https://www.youtube.com/watch?v=${ID}  `,
  ])('reads %s', (input) => {
    expect(parseYouTubeId(input)).toBe(ID);
  });

  it.each([
    '',
    'not a link',
    `https://vimeo.com/${ID}`,
    `https://evil.example/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UCabcdefghijk',
    'https://youtu.be/',
  ])('rejects %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});

describe('youtube urls', () => {
  it('builds a watch url', () => {
    expect(youTubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it('builds an autoplaying privacy-enhanced embed', () => {
    expect(youTubeEmbedUrl(ID, { muted: true })).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&mute=1&playsinline=1&rel=0`,
    );
    expect(youTubeEmbedUrl(ID, { muted: false })).toContain('mute=0');
  });
});
