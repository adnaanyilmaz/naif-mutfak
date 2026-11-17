'use client';

import { useEffect, useRef, useState } from 'react';
import { youTubeEmbedUrl } from '@/services/media/youtube';
import type { VideoMode } from '@/validators/content';

interface RecipeVideoProps {
  youtubeId: string;
  mode: VideoMode;
  title: string;
  labels: { watch: string; close: string };
}

/** Auto mode opens once per browser session, so reloading or coming back does not reopen a dismissed popup. */
const seenKey = (id: string) => `nm:video-seen:${id}`;

function markSeen(id: string): boolean {
  try {
    if (sessionStorage.getItem(seenKey(id))) return false;
    sessionStorage.setItem(seenKey(id), '1');
    return true;
  } catch {
    return true;
  }
}

export function RecipeVideo({ youtubeId, mode, title, labels }: RecipeVideoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // `muted` is only true for the page-load open: browsers block sound without a click.
  const [playing, setPlaying] = useState<{ muted: boolean } | null>(null);

  const open = (muted: boolean) => {
    setPlaying({ muted });
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    if (mode !== 'auto') return;
    // Deferred so the check-and-mark runs once even when Strict Mode mounts the effect twice.
    const timer = setTimeout(() => {
      if (!markSeen(youtubeId)) return;
      setPlaying({ muted: true });
      dialogRef.current?.showModal();
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, youtubeId]);

  return (
    <>
      <button
        type="button"
        onClick={() => open(false)}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-pill bg-terracotta px-4 text-ui font-semibold text-white transition-colors duration-200 ease-editorial hover:bg-terracotta-deep print:hidden"
      >
        <span aria-hidden>▶</span>
        {labels.watch}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        onClose={() => setPlaying(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(100%-2rem,64rem)] overflow-visible bg-transparent p-0 backdrop:bg-black/75 print:hidden"
      >
        <div className="flex justify-end pb-2">
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-10 items-center gap-2 rounded-pill bg-white px-4 text-ui font-semibold text-charcoal hover:bg-linen"
          >
            <span aria-hidden>×</span>
            {labels.close}
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card">
          {playing && (
            <iframe
              src={youTubeEmbedUrl(youtubeId, playing)}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          )}
        </div>
      </dialog>
    </>
  );
}
