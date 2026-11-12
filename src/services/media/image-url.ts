/** Public media URL for a MEDIA_PUBLIC key, optionally via Cloudflare Image Transformations. */
export function mediaUrl(baseUrl: string, key: string, width?: number): string {
  const base = baseUrl.replace(/\/+$/, '');
  const path = key.split('/').map(encodeURIComponent).join('/');
  return width ? `${base}/cdn-cgi/image/width=${width},format=auto/${path}` : `${base}/${path}`;
}
