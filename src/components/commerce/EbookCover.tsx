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
      <img src={ebook.coverUrl} alt={ebook.coverAlt} className={`${frame} object-cover`} loading="lazy" />
    );
  }
  return (
    <div
      role="img"
      aria-label={ebook.coverAlt}
      className={`${frame} relative flex flex-col justify-between bg-gradient-to-br from-[#fb923c] via-terracotta to-[#7c2d12] text-white ${size === 'sm' ? 'p-1.5' : 'p-5'}`}
    >
      <div aria-hidden className="absolute inset-y-0 start-0 w-2 bg-black/15" />
      {size !== 'sm' && (
        <>
          <span aria-hidden className="relative text-[0.6875rem] font-bold tracking-[0.12em] uppercase opacity-80 arabic:normal-case arabic:tracking-normal">
            naif mutfak
          </span>
          <span aria-hidden className={`relative font-display leading-tight font-extrabold ${size === 'lg' ? 'text-h2' : 'text-h3'}`}>
            {ebook.title}
          </span>
        </>
      )}
    </div>
  );
}
