import type { EbookView } from '@/services/catalog/catalog.service';

interface EbookCoverProps {
  ebook: EbookView;
  size?: 'sm' | 'md' | 'lg';
}

const WIDTH = { sm: 'w-16', md: 'w-36 md:w-44', lg: 'w-full max-w-xs' } as const;

/** 3:4 cover: uploaded image or a typographic placeholder. */
export function EbookCover({ ebook, size = 'md' }: EbookCoverProps) {
  const frame = `${WIDTH[size]} aspect-[3/4] shrink-0 overflow-hidden rounded-card shadow-card`;
  if (ebook.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs are pre-sized by Cloudflare Image Transformations.
      <img src={ebook.coverUrl} alt={ebook.coverAlt} className={`${frame} object-cover`} loading="lazy" />
    );
  }
  return (
    <div role="img" aria-label={ebook.coverAlt} className={`${frame} flex flex-col justify-between bg-terracotta p-3 text-paper`}>
      <span aria-hidden className="text-eyebrow font-semibold uppercase opacity-80 arabic:normal-case">
        Naif Mutfak
      </span>
      {size !== 'sm' && (
        <span aria-hidden className="font-display text-h3 leading-tight font-semibold">
          {ebook.title}
        </span>
      )}
    </div>
  );
}
