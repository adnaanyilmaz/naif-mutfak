'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { storedDraftSchema, type StoredDraft } from '@/validators/admin/post-form';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Unsaved editor state in localStorage (`nm:admin:draft:{postId}`), validated on read. */
export function useStoredDraft(postId: string) {
  const key = `nm:admin:draft:${postId}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const draft = useMemo<StoredDraft | null>(() => {
    if (!raw) return null;
    try {
      const parsed = storedDraftSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [raw]);

  const write = useCallback(
    (value: StoredDraft) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Quota or privacy mode: autosave is best effort.
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    notify();
  }, [key]);

  return { draft, write, clear };
}
