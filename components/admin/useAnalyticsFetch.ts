'use client';

import { useEffect, useState } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Shared fetch-on-dependency-change hook for the client-rendered analytics
 * widgets (Overview's Sales Performance, the whole Analytics page) — one
 * place to get loading/error/stale-response handling right instead of every
 * widget re-implementing its own `useEffect` + `fetch`.
 */
export function useAnalyticsFetch<T>(url: string): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });

  // Reset to "loading" as soon as `url` changes, adjusted during render
  // (React's recommended pattern for state that depends on a prop) rather
  // than as a synchronous setState inside the effect below.
  const [requestedUrl, setRequestedUrl] = useState(url);
  if (url !== requestedUrl) {
    setRequestedUrl(url);
    setState((s) => ({ ...s, loading: true, error: null }));
  }

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load data.' });
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
