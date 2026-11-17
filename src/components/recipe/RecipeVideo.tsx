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

/**
 * Floating, non-modal player docked to the bottom corner: the page stays scrollable and
 * interactive, so the recipe can be read (and steps ticked off) while the video plays.
 */
export function RecipeVideo({ youtubeId, mode, title, labels }: RecipeVideoProps) {
  // `muted` is only true for the page-load open: browsers block sound without a click.
  const [playing, setPlaying] = useState<{ muted: boolean } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = playing !== null;

  useEffect(() => {
    if (mode !== 'auto') return;
    // Deferred so the check-and-mark runs once even when Strict Mode mounts the effect twice.
    const timer = setTimeout(() => {
      if (markSeen(youtubeId)) setPlaying({ muted: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, youtubeId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        // Re-clicking while the muted page-load player is open restarts it with sound.
        onClick={() => {
          setPlaying({ muted: false });
          requestAnimationFrame(() => closeRef.current?.focus());
        }}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-pill bg-terracotta px-4 text-ui font-semibold text-white transition-colors duration-200 ease-editorial hover:bg-terracotta-deep print:hidden"
      >
        <span aria-hidden>▶</span>
        {labels.watch}
      </button>
      {playing && (
        <section
          aria-label={title}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 overflow-hidden rounded-2xl bg-charcoal shadow-[0_12px_40px_rgb(0_0_0/0.35)] sm:inset-x-auto sm:end-4 sm:bottom-4 sm:w-[22rem] lg:w-[28rem] print:hidden"
        >
          <div className="flex items-center justify-between gap-3 py-1.5 ps-4 pe-1.5">
            <p className="truncate text-[0.8125rem] font-semibold text-white">{title}</p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setPlaying(null)}
              aria-label={labels.close}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-xl leading-none text-white hover:bg-white/15"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <div className="aspect-video w-full bg-black">
            <iframe
              key={playing.muted ? 'muted' : 'sound'}
              src={youTubeEmbedUrl(youtubeId, playing)}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          </div>
        </section>
      )}
    </>
  );
}
