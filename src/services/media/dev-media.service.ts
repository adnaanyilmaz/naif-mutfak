// Local development only: serves MEDIA_PUBLIC originals at MEDIA_PUBLIC_URL (http://localhost:3000/media).
export interface DevMediaDeps {
  environment: 'development' | 'preview' | 'production';
  getObject: (key: string) => Promise<{ body: ReadableStream; contentType: string | null; size: number } | null>;
}

const MEDIA_KEY = /^(posts|products)\/[\w-]+\/[\w-]+\.(jpg|png|webp|avif)$/;

export async function readDevMedia(deps: DevMediaDeps, key: string) {
  if (deps.environment !== 'development' || !MEDIA_KEY.test(key)) return null;
  return deps.getObject(key);
}
