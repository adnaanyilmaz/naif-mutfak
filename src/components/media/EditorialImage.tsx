interface EditorialImageProps {
  src: string | null;
  alt: string;
  /** Tailwind aspect utility, e.g. `aspect-[4/3]`. */
  aspect: string;
  /** Picks the placeholder tint when no image exists yet. */
  category?: string;
  priority?: boolean;
  /** Corner radius utility for the frame. */
  radius?: string;
  /** Subtle zoom when an ancestor `.group` is hovered. */
  zoom?: boolean;
}

const TINTS: Record<string, string> = {
  bread: 'from-[#fde7c8] via-[#fbd7a8] to-[#f3b77b]',
  pastry: 'from-[#ffe4dc] via-[#fcc9b6] to-[#f29f80]',
};

/** Bowl + steam line icon for image-less posts. */
function PlaceholderIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="size-1/4 max-h-24 max-w-24">
      <path d="M10 34h44a22 22 0 0 1-44 0Z" />
      <path d="M24 26c-2-3 2-5 0-8M32 26c-2-3 2-5 0-8M40 26c-2-3 2-5 0-8" />
      <path d="M22 56h20" />
    </svg>
  );
}

/** MEDIA_PUBLIC image (already transformed URL) or a soft gradient placeholder. */
export function EditorialImage({ src, alt, aspect, category, priority = false, radius = 'rounded-card', zoom = false }: EditorialImageProps) {
  const frame = `${aspect} ${radius} relative w-full overflow-hidden bg-linen`;
  const motion = zoom ? 'transition-transform duration-500 ease-editorial group-hover:scale-[1.04]' : '';
  if (!src) {
    const tint = TINTS[category ?? ''] ?? 'from-[#f1efec] via-[#e9e5e0] to-[#ddd6cd]';
    return (
      <div role="img" aria-label={alt} className={frame}>
        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${tint} text-white/90 ${motion}`}>
          <PlaceholderIcon />
        </div>
      </div>
    );
  }
  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- URLs are pre-sized by Cloudflare Image Transformations. */}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={`absolute inset-0 size-full object-cover ${motion}`}
      />
    </div>
  );
}
