import { describe, expect, it } from 'vitest';
import { readDevMedia, type DevMediaDeps } from './dev-media.service';

const KEY = 'posts/7b0c6c1e-0a51-4c39-9a3e-5f1d2c9e1a01/4f3c2b1a-0d9e-4c8b-9a7f-6e5d4c3b2a11.jpg';

function deps(environment: DevMediaDeps['environment']) {
  const requested: string[] = [];
  const d: DevMediaDeps = {
    environment,
    getObject: async (key) => {
      requested.push(key);
      return { body: new ReadableStream(), contentType: 'image/jpeg', size: 1 };
    },
  };
  return { d, requested };
}

describe('readDevMedia', () => {
  it('serves originals and strips the Image Transformations prefix locally', async () => {
    const { d, requested } = deps('development');
    expect(await readDevMedia(d, KEY)).not.toBeNull();
    expect(await readDevMedia(d, `cdn-cgi/image/width=1080,format=auto/${KEY}`)).not.toBeNull();
    expect(requested).toEqual([KEY, KEY]);
  });

  it('refuses outside development and for non-media keys', async () => {
    expect(await readDevMedia(deps('production').d, KEY)).toBeNull();
    const { d, requested } = deps('development');
    expect(await readDevMedia(d, 'ebooks/p/v/x.pdf')).toBeNull();
    expect(await readDevMedia(d, `posts/../${KEY}`)).toBeNull();
    expect(requested).toEqual([]);
  });
});
