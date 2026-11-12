import { Logo } from '@/components/layout/Logo';
import type { EbookView } from '@/services/catalog/catalog.service';

interface EbookCoverProps {
  ebook: EbookView;
  size?: 'sm' | 'md' | 'lg';
}

const WIDTH = { sm: 'w-14', md: 'w-40 md:w-48', lg: 'w-full max-w-[18rem]' } as const;

/** 3:4 cover: uploaded image or a gradient typographic placeholder. */
export function EbookCover({ ebook, size = 'md' }: EbookCoverProps) {
  const radius = size === 'sm' ? 'rounded-lg' : 'rounded-2xl';
  const frame = `${WIDTH[size]} ${radius} aspect-[3/4] shrink-0 overflow-hidden shadow-lift`;
  if (ebook.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs are pre-sized by Cloudflare Image Transformations.
      <img
        src={ebook.coverUrl}
        alt={ebook.coverAlt}
        className={`${frame} object-cover`}
        // The large cover is the detail page's main image: load it immediately.
        loading={size === 'lg' ? 'eager' : 'lazy'}
        fetchPriority={size === 'lg' ? 'high' : 'auto'}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={ebook.coverAlt}
      className={`${frame} relative flex flex-col justify-between bg-gradient-to-br from-brand via-[#d96d04] to-[#8a3b06] text-white ${size === 'sm' ? 'p-1.5' : 'p-5'}`}
    >
      <div aria-hidden className="absolute inset-y-0 start-0 w-2 bg-black/15" />
      {size !== 'sm' && (
        <>
          <span aria-hidden className="relative">
            <Logo size={size === 'lg' ? 52 : 36} wordmark={false} />
          </span>
          <span aria-hidden className={`relative font-display leading-tight font-extrabold ${size === 'lg' ? 'text-h2' : 'text-h3'}`}>
            {ebook.title}
          </span>
        </>
      )}
    </div>
  );
}
