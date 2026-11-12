// Local development only: serves MEDIA_PUBLIC originals at MEDIA_PUBLIC_URL (http://localhost:3000/media).
export interface DevMediaDeps {
  environment: 'development' | 'preview' | 'production';
  getObject: (key: string) => Promise<{ body: ReadableStream; contentType: string | null; size: number } | null>;
}

const MEDIA_KEY = /^(posts|products)\/[\w-]+\/[\w-]+\.(jpg|png|webp|avif)$/;

/** Image Transformations prefix (`cdn-cgi/image/width=1080,format=auto/`) has no local equivalent: serve the original. */
const TRANSFORM_PREFIX = /^cdn-cgi\/image\/[^/]+\//;

export async function readDevMedia(deps: DevMediaDeps, path: string) {
  const key = path.replace(TRANSFORM_PREFIX, '');
  if (deps.environment !== 'development' || !MEDIA_KEY.test(key)) return null;
  return deps.getObject(key);
}
