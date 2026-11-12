interface EditorialImageProps {
  src: string | null;
  alt: string;
  /** Tailwind aspect utility, e.g. `aspect-[4/5]`. */
  aspect: string;
  /** Shown on the placeholder when no image exists yet. */
  monogram: string;
  priority?: boolean;
}

/** MEDIA_PUBLIC image (already transformed URL) or a quiet linen placeholder. */
export function EditorialImage({ src, alt, aspect, monogram, priority = false }: EditorialImageProps) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${aspect} flex w-full items-center justify-center overflow-hidden rounded-card bg-linen`}
      >
        <span aria-hidden className="font-display text-display text-hairline select-none">
          {monogram}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URLs are pre-sized by Cloudflare Image Transformations.
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`${aspect} w-full rounded-card object-cover`}
    />
  );
}
