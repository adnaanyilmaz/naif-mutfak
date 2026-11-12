'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';

const progressSchema = z.object({ i: z.array(z.string()).default([]), s: z.array(z.string()).default([]) });
type Progress = z.infer<typeof progressSchema>;

const EVENT = 'nm:recipe-progress';
const EMPTY: Progress = { i: [], s: [] };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function parse(raw: string | null): Progress {
  if (!raw) return EMPTY;
  try {
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Ingredient/step check-off state persisted in localStorage (`nm:recipe:{postId}:{locale}`). SSR renders unchecked. */
export function useRecipeProgress(storageKey: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => null,
  );
  const progress = useMemo(() => parse(raw), [raw]);
  const checked = useMemo(() => new Set(progress.i), [progress]);
  const done = useMemo(() => new Set(progress.s), [progress]);

  const write = useCallback(
    (next: Progress) => {
      try {
        if (next.i.length === 0 && next.s.length === 0) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode): state simply does not persist.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [storageKey],
  );

  const toggle = useCallback(
    (list: 'i' | 's', id: string) => {
      const current = parse(read(storageKey));
      const set = new Set(current[list]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      write({ ...current, [list]: [...set] });
    },
    [storageKey, write],
  );

  return {
    checked,
    done,
    toggleIngredient: (id: string) => toggle('i', id),
    toggleStep: (id: string) => toggle('s', id),
    reset: () => write(EMPTY),
    hasProgress: checked.size > 0 || done.size > 0,
  };
}
