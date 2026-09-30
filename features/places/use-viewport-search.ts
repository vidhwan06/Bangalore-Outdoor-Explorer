// Viewport (bounds) discovery for the /explore map.
 //
 // The map component only emits serializable bounds; this hook owns when and
 // how the bounds API is called: debouncing so one request fires after the
 // viewport settles, aborting superseded requests, and guarding every response
 // with a sequence number so an older request can never overwrite newer results.
 // Supports pagination: first page at offset 0, subsequent pages append.

 import { useCallback, useEffect, useRef, useState } from 'react';
 import { fetchPlacesInBounds, type BoundsPlacesQuery } from './bounds';
 import { NearbyApiError, type NearbyPlacesResponse } from './nearby';

 /** Debounce window — a bounds request fires once the viewport settles. */
 export const VIEWPORT_SEARCH_DEBOUNCE_MS = 300;

 export type ViewportSearchStatus = 'idle' | 'loading' | 'loading_more' | 'error';

 /** Viewport-specific failure messages (non-disruptive — results are kept). */
 export const VIEWPORT_ERROR_MESSAGES = {
   network: 'Map update failed. Check your connection and try again.',
   http: 'Map update failed. Please try again.',
   rate_limited: 'Map update failed. Too many searches in a short time — wait a moment.',
   invalid_response: 'Map update failed. The server returned an unexpected response.',
 } as const;

 export interface UseViewportSearchOptions {
   /** Called only for responses that are still the latest request. */
   onResults: (response: NearbyPlacesResponse, isLoadMore: boolean) => void;
   /** Override for tests; production uses VIEWPORT_SEARCH_DEBOUNCE_MS. */
   debounceMs?: number;
 }

 export interface ViewportSearch {
   status: ViewportSearchStatus;
   errorMessage: string | null;
   /** Current pagination offset. */
   offset: number;
   /** Whether there are more results to load. */
   hasMore: boolean;
   /** Total result count for the current viewport. */
   totalCount: number;
   /** Queues a bounds search — debounced, supersedes pending/in-flight work. Starts at offset 0. */
   schedule: (query: BoundsPlacesQuery) => void;
   /** Loads the next page of results for the current viewport. */
   loadMore: () => void;
   /** Re-runs the most recent bounds query (used by the error banner). */
   retry: () => void;
   /** Drops pending and in-flight viewport requests (e.g. a new radius search). */
   cancel: () => void;
 }

 export function useViewportSearch(options: UseViewportSearchOptions): ViewportSearch {
   const { onResults, debounceMs = VIEWPORT_SEARCH_DEBOUNCE_MS } = options;

   const [status, setStatus] = useState<ViewportSearchStatus>('idle');
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const [offset, setOffset] = useState(0);
   const [hasMore, setHasMore] = useState(false);
   const [totalCount, setTotalCount] = useState(0);

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

   const perform = useCallback(
     async (query: BoundsPlacesQuery, sequence: number, isLoadMore: boolean) => {
       const controller = new AbortController();
       controllerRef.current = controller;

       try {
         const response = await fetchPlacesInBounds(query, { signal: controller.signal });
         if (sequence !== sequenceRef.current) {
           return; // stale — a newer schedule/cancel superseded this request
         }
         onResultsRef.current(response, isLoadMore);
         setStatus('idle');
         setErrorMessage(null);
         setHasMore(response.pagination.hasMore);
         setTotalCount(response.pagination.count);
         if (!isLoadMore) {
           setOffset(response.pagination.limit);
         } else {
           setOffset((prev) => prev + response.pagination.limit);
         }
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
     },
     []
   );

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

       // New viewport search: reset pagination, start at offset 0
       const queryWithReset = { ...query, offset: 0, limit: query.limit ?? 20 };
       lastQueryRef.current = queryWithReset;
       setStatus('loading');
       setErrorMessage(null);
       setOffset(0);
       setHasMore(false);

       timerRef.current = setTimeout(() => {
         timerRef.current = null;
         void perform(queryWithReset, sequence, false);
       }, debounceMs);
     },
     [debounceMs, perform]
   );

   const loadMore = useCallback(() => {
     if (!lastQueryRef.current || !hasMore || status === 'loading_more') {
       return;
     }
     sequenceRef.current += 1;
     const sequence = sequenceRef.current;

     const loadMoreQuery = {
       ...lastQueryRef.current,
       offset,
       limit: lastQueryRef.current.limit ?? 20,
     };
     lastQueryRef.current = loadMoreQuery;
     setStatus('loading_more');
     setErrorMessage(null);

     void perform(loadMoreQuery, sequence, true);
   }, [hasMore, offset, perform, status]);

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
     setOffset(0);
     setHasMore(false);
     setTotalCount(0);
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

   return { status, errorMessage, offset, hasMore, totalCount, schedule, loadMore, retry, cancel };
 }