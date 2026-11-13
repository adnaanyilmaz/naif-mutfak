import { Logo } from '@/components/layout/Logo';
import type { EbookView } from '@/services/catalog/catalog.service';

interface EbookCoverProps {
  ebook: EbookView;
  /** `fill`: an uploaded cover spans its container edge to edge (the container rounds and clips it). */
  size?: 'sm' | 'md' | 'lg' | 'fill';
  priority?: boolean;
}

const WIDTH = { sm: 'w-14', md: 'w-40 md:w-48', lg: 'w-full max-w-[18rem]', fill: 'w-full max-w-[18rem]' } as const;

/** Uploaded cover at its own aspect ratio (never cropped), or a 3:4 gradient typographic placeholder. */
export function EbookCover({ ebook, size = 'md', priority = false }: EbookCoverProps) {
  const radius = size === 'sm' ? 'rounded-lg' : 'rounded-2xl';
  if (ebook.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs are pre-sized by Cloudflare Image Transformations.
      <img
        src={ebook.coverUrl}
        alt={ebook.coverAlt}
        // Placeholder 3:4 box until the image loads; afterwards its natural ratio wins (aspect-ratio: auto).
        width={600}
        height={800}
        className={size === 'fill' ? 'block h-auto w-full' : `${WIDTH[size]} ${radius} h-auto shrink-0 shadow-lift`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    );
  }
  const placeholderSize = size === 'fill' ? 'lg' : size;
  const frame = `${WIDTH[placeholderSize]} ${radius} aspect-[3/4] shrink-0 overflow-hidden shadow-lift`;
  return (
    <div
      role="img"
      aria-label={ebook.coverAlt}
      className={`${frame} relative flex flex-col justify-between bg-gradient-to-br from-brand via-[#d96d04] to-[#8a3b06] text-white ${placeholderSize === 'sm' ? 'p-1.5' : 'p-5'}`}
    >
      <div aria-hidden className="absolute inset-y-0 start-0 w-2 bg-black/15" />
      {placeholderSize !== 'sm' && (
        <>
          <span aria-hidden className="relative">
            <Logo size={placeholderSize === 'lg' ? 52 : 36} wordmark={false} />
          </span>
          <span aria-hidden className={`relative font-display leading-tight font-extrabold ${placeholderSize === 'lg' ? 'text-h2' : 'text-h3'}`}>
            {ebook.title}
          </span>
        </>
      )}
    </div>
  );
}
