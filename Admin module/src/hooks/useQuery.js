import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/api";

/**
 * Minimal data hook: runs `fetcher` when `deps` change, tracks loading/error,
 * ignores stale responses and exposes `refetch` / `setData` for optimistic updates.
 */
export function useQuery(fetcher, deps = [], { enabled = true, pollMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const sequence = useRef(0);
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => { fetcherRef.current = fetcher; });

  const run = useCallback(async ({ silent = false } = {}) => {
    const current = ++sequence.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const result = await fetcherRef.current();
      if (current === sequence.current) { setData(result); setUpdatedAt(new Date()); }
      return result;
    } catch (err) {
      if (current === sequence.current) setError(errorMessage(err));
      return null;
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    // Kick off asynchronously so the effect itself never sets state synchronously.
    const start = setTimeout(() => run(), 0);
    const id = pollMs ? setInterval(() => run({ silent: true }), pollMs) : null;
    return () => { clearTimeout(start); if (id) clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMs, run, ...deps]);

  return { data, setData, loading: enabled && loading, error, refetch: run, updatedAt };
}

export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
