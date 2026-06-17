import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cubestats:recent";
const MAX_RECENT = 6;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Tracks recently viewed WCA IDs in localStorage (most-recent-first, deduped,
 * capped). Returns the list plus a `remember` callback to push a new ID.
 */
export function useRecentSearches(): {
  recent: string[];
  remember: (wcaId: string) => void;
} {
  const [recent, setRecent] = useState<string[]>([]);

  // localStorage is unavailable during SSR, so hydrate on mount.
  useEffect(() => {
    setRecent(read());
  }, []);

  const remember = useCallback((wcaId: string) => {
    setRecent((current) => {
      const next = [wcaId, ...current.filter((id) => id !== wcaId)].slice(
        0,
        MAX_RECENT
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures (private mode, disabled storage).
      }
      return next;
    });
  }, []);

  return { recent, remember };
}
