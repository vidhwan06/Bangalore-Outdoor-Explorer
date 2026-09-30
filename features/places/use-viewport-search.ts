// Viewport (bounds) discovery for the /explore map.
//
// The map component only emits serializable bounds; this hook owns when and
// how the bounds API is called: debouncing so one request fires after the
// viewport settles, aborting superseded requests, and guarding every response
// with a sequence number so an older request can never overwrite newer results.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlacesInBounds, type BoundsPlacesQuery } from './bounds';
import { NearbyApiError, type NearbyPlacesResponse } from './nearby';

/** Debounce window — a bounds request fires once the viewport settles. */
export const VIEWPORT_SEARCH_DEBOUNCE_MS = 300;

export type ViewportSearchStatus = 'idle' | 'loading' | 'error';

/** Viewport-specific failure messages (non-disruptive — results are kept). */
export const VIEWPORT_ERROR_MESSAGES = {
  network: 'Map update failed. Check your connection and try again.',
  http: 'Map update failed. Please try again.',
  rate_limited: 'Map update failed. Too many searches in a short time — wait a moment.',
  invalid_response: 'Map update failed. The server returned an unexpected response.',
} as const;

export interface UseViewportSearchOptions {
  /** Called only for responses that are still the latest request. */
  onResults: (response: NearbyPlacesResponse) => void;
  /** Override for tests; production uses VIEWPORT_SEARCH_DEBOUNCE_MS. */
  debounceMs?: number;
}

export interface ViewportSearch {
  status: ViewportSearchStatus;
  errorMessage: string | null;
  /** Queues a bounds search — debounced, supersedes pending/in-flight work. */
  schedule: (query: BoundsPlacesQuery) => void;
  /** Re-runs the most recent bounds query (used by the error banner). */
  retry: () => void;
  /** Drops pending and in-flight viewport requests (e.g. a new radius search). */
  cancel: () => void;
}

export function useViewportSearch(options: UseViewportSearchOptions): ViewportSearch {
  const { onResults, debounceMs = VIEWPORT_SEARCH_DEBOUNCE_MS } = options;

  const [status, setStatus] = useState<ViewportSearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Always call the latest callback without resubscribing effects.
  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // Incremented on every schedule/cancel — a response carrying an older
  // sequence number is stale and must never overwrite newer results.
  const sequenceRef = useRef(0);
  const lastQueryRef = useRef<BoundsPlacesQuery | null>(null);

  const perform = useCallback(async (query: BoundsPlacesQuery, sequence: number) => {
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetchPlacesInBounds(query, { signal: controller.signal });
      if (sequence !== sequenceRef.current) {
        return; // stale — a newer schedule/cancel superseded this request
      }
      onResultsRef.current(response);
      setStatus('idle');
      setErrorMessage(null);
    } catch (error) {
      if (sequence !== sequenceRef.current) {
        return; // stale
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return; // cancelled — keep current state
      }
      const code = error instanceof NearbyApiError ? error.code : 'http';
      setErrorMessage(VIEWPORT_ERROR_MESSAGES[code]);
      setStatus('error');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, []);

  const schedule = useCallback(
    (query: BoundsPlacesQuery) => {
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;

      // Supersede anything already waiting or in flight.
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      controllerRef.current?.abort();
      controllerRef.current = null;

      lastQueryRef.current = query;
      setStatus('loading');
      setErrorMessage(null);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void perform(query, sequence);
      }, debounceMs);
    },
    [debounceMs, perform]
  );

  const cancel = useCallback(() => {
    sequenceRef.current += 1;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  const retry = useCallback(() => {
    if (lastQueryRef.current) {
      schedule(lastQueryRef.current);
    }
  }, [schedule]);

  // Unmount: drop pending timers and abort in-flight work.
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      controllerRef.current?.abort();
    },
    []
  );

  return { status, errorMessage, schedule, retry, cancel };
}
