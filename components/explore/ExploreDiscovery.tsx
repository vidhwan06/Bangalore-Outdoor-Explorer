'use client';

// Discovery container — the only place that performs client-side data fetching.
// UI -> fetchNearbyPlaces()      -> GET /api/places/nearby  -> service -> repository -> PostGIS
//    -> useViewportSearch()      -> GET /api/places/bounds  -> service -> repository -> PostGIS
//
// Both result sets flow through one state (places) so the list and the map
// always represent the same data, and every marker is produced by the central
// privacy mapper (toMapPlacePoint) — the map never sees raw coordinates.

import { useCallback, useMemo, useRef, useState } from 'react';
import { roundCoordinate } from '@/lib/utils';
import {
  DEFAULT_RADIUS_METERS,
  DEFAULT_SEARCH_CENTER,
  SEARCH_RESULT_LIMIT,
  parseFilterValues,
  validateDiscoveryLocation,
} from '@/features/places/discovery';
import {
  NEARBY_ERROR_MESSAGES,
  NearbyApiError,
  fetchNearbyPlaces,
  type NearbyPlace,
  type NearbyPlacesResponse,
} from '@/features/places/nearby';
import type { MapBounds } from '@/features/places/bounds';
import { toMapPlacePoint } from '@/features/places/map-places';
import { useViewportSearch } from '@/features/places/use-viewport-search';
import type { PlaceCategory } from '@/lib/validation/schemas';
import { DiscoveryControls, type DiscoveryFormValues } from './DiscoveryControls';
import { DiscoveryHeader } from './DiscoveryHeader';
import { DiscoveryResults, type DiscoveryStatus } from './DiscoveryResults';
import { MapListToggle, type MapListView } from './MapListToggle';
import type { DiscoveryOrigin, DiscoveryResultMode } from './NearbyPlaceCard';
import { PlaceMap } from '@/components/map/PlaceMap';

export interface ExploreDiscoveryProps {
  /** Category preselected from the URL (e.g. /explore?category=trek). */
  initialCategory?: PlaceCategory;
}

export function ExploreDiscovery({ initialCategory }: ExploreDiscoveryProps) {
  const [values, setValues] = useState<DiscoveryFormValues>({
    latitude: String(DEFAULT_SEARCH_CENTER.latitude),
    longitude: String(DEFAULT_SEARCH_CENTER.longitude),
    radiusMeters: DEFAULT_RADIUS_METERS,
    category: initialCategory ?? '',
    difficulty: '',
  });

  const [status, setStatus] = useState<DiscoveryStatus>('idle');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ latitude?: string; longitude?: string }>({});
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<DiscoveryOrigin | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<DiscoveryResultMode>('radius');
  const [fitBoundsDone, setFitBoundsDone] = useState(false);
  // Mobile map/list view state. Default to 'list' on mobile for better initial UX.
  const [mobileView, setMobileView] = useState<MapListView>('list');

  // Guards result application across both flows: whichever request settles
  // last in *intent* order wins — an older response can never overwrite a
  // newer one (see runSearch / handleViewportResults).
  const resultsSequenceRef = useRef(0);
  const hasInitialFitRunRef = useRef(false);

  const handleValuesChange = useCallback((patch: Partial<DiscoveryFormValues>) => {
    setValues((previous) => ({ ...previous, ...patch }));
    setFieldErrors((previous) => {
      if (!previous.latitude && !previous.longitude) return previous;
      const next = { ...previous };
      if ('latitude' in patch) delete next.latitude;
      if ('longitude' in patch) delete next.longitude;
      return next;
    });
  }, []);

  /** Single place both flows write results through. */
  const applyResults = useCallback((response: NearbyPlacesResponse, mode: DiscoveryResultMode) => {
    setPlaces(response.data);
    setTotalCount(response.pagination.count);
    setStatus('success');
    setResultMode(mode);
    setSelectedPlaceId(null);

    // Trigger one-time auto-fit to the initial radius-search results.
    if (mode === 'radius' && !hasInitialFitRunRef.current) {
      hasInitialFitRunRef.current = true;
      setFitBoundsDone(true);
      // Reset after the map completes the fit so the flag is available if
      // the component remounts (the ref persists for the session).
      // The onFitBoundsComplete callback will reset fitBoundsDone.
    }
  }, []);

  // Viewport (bounds) discovery: debounce, aborts and stale-response
  // protection live in features/places/use-viewport-search — not in the map.
  const handleViewportResults = useCallback(
    (response: NearbyPlacesResponse, isLoadMore: boolean) => {
      // Claim the latest intent — any radius search still in flight is older.
      resultsSequenceRef.current += 1;
      if (isLoadMore) {
        // Append new results to existing places
        setPlaces((prev) => [...prev, ...response.data]);
        setTotalCount(response.pagination.count);
        setStatus('success');
        setResultMode('bounds');
        setSelectedPlaceId(null);
      } else {
        // New viewport search: replace results
        applyResults(response, 'bounds');
      }
    },
    [applyResults]
  );

  const viewportSearch = useViewportSearch({ onResults: handleViewportResults });
  const {
    status: viewportStatus,
    errorMessage: viewportErrorMessage,
    offset: viewportOffset,
    hasMore: viewportHasMore,
    totalCount: viewportTotalCount,
    schedule: scheduleViewportSearch,
    loadMore: loadMoreViewport,
    retry: retryViewportSearch,
    cancel: cancelViewportSearch,
  } = viewportSearch;

  const runSearch = useCallback(async () => {
    const validated = validateDiscoveryLocation({
      latitude: values.latitude,
      longitude: values.longitude,
    });
    if (!validated.valid) {
      setFieldErrors(validated.fieldErrors);
      return;
    }

    // A new radius search supersedes pending/in-flight viewport work.
    cancelViewportSearch();
    const sequence = ++resultsSequenceRef.current;

    setFieldErrors({});
    setLocationMessage(null);
    setErrorMessage(null);
    setStatus('loading');

    const filters = parseFilterValues({ category: values.category, difficulty: values.difficulty });

    try {
      const response = await fetchNearbyPlaces({
        lat: validated.latitude,
        lng: validated.longitude,
        radiusMeters: values.radiusMeters,
        limit: SEARCH_RESULT_LIMIT,
        category: filters.category,
        difficulty: filters.difficulty,
      });
      if (sequence !== resultsSequenceRef.current) {
        return; // a newer result set landed while this search was in flight
      }
      applyResults(response, 'radius');
      setSearchOrigin({ lat: validated.latitude, lng: validated.longitude });
    } catch (error) {
      if (sequence !== resultsSequenceRef.current) {
        return;
      }
      const code = error instanceof NearbyApiError ? error.code : 'http';
      setErrorMessage(NEARBY_ERROR_MESSAGES[code]);
      setStatus('error');
    }
  }, [values, applyResults, cancelViewportSearch]);

  /** Map viewport settled -> debounced bounds search with the active filters. */
  const handleBoundsChange = useCallback(
    (bounds: MapBounds) => {
      const filters = parseFilterValues({
        category: values.category,
        difficulty: values.difficulty,
      });
      scheduleViewportSearch({
        ...bounds,
        limit: SEARCH_RESULT_LIMIT,
        category: filters.category,
        difficulty: filters.difficulty,
      });
    },
    [values.category, values.difficulty, scheduleViewportSearch]
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocationMessage('Location is not available in this browser. Enter coordinates manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValues((previous) => ({
          ...previous,
          latitude: String(roundCoordinate(position.coords.latitude)),
          longitude: String(roundCoordinate(position.coords.longitude)),
        }));
        setFieldErrors({});
        setLocationMessage(null);
      },
      (error) => {
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Enter coordinates manually.'
            : 'Could not read your location. Enter coordinates manually.'
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // Privacy boundary: raw API rows -> MapPlacePoint[] before touching the map.
  const mapPlaces = useMemo(() => places.map(toMapPlacePoint), [places]);

  // Initial view only (react-leaflet ignores later center changes): the form's
  // origin, falling back to the shared discovery default — never baked into
  // the map component itself.
  const mapCenter = useMemo(() => {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    return {
      latitude: Number.isFinite(latitude) ? latitude : DEFAULT_SEARCH_CENTER.latitude,
      longitude: Number.isFinite(longitude) ? longitude : DEFAULT_SEARCH_CENTER.longitude,
    };
  }, [values.latitude, values.longitude]);

  return (
    <div className="min-h-screen">
      <DiscoveryHeader />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <DiscoveryControls
          values={values}
          onValuesChange={handleValuesChange}
          onSearch={runSearch}
          onUseCurrentLocation={handleUseCurrentLocation}
          isLoading={status === 'loading'}
          fieldErrors={fieldErrors}
          locationMessage={locationMessage}
        />

        {/* Mobile Map/List toggle — hidden on desktop */}
        <MapListToggle
          view={mobileView}
          onChange={setMobileView}
          hasMapResults={mapPlaces.some((p) => p.location.kind !== 'unavailable')}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* List view — visible on mobile when mobileView='list', always visible on desktop */}
          <div className={mobileView === 'map' ? 'lg:block hidden' : 'block'}>
            <DiscoveryResults
              status={status}
              places={places}
              totalCount={resultMode === 'bounds' ? viewportTotalCount : totalCount}
              radiusMeters={values.radiusMeters}
              origin={searchOrigin}
              errorMessage={errorMessage}
              mode={resultMode}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              onRetry={runSearch}
              viewportHasMore={resultMode === 'bounds' ? viewportHasMore : false}
              viewportOffset={resultMode === 'bounds' ? viewportOffset : 0}
              viewportLoading={viewportStatus === 'loading_more'}
              onLoadMoreViewport={resultMode === 'bounds' ? loadMoreViewport : undefined}
            />
          </div>

          {/* Map view — visible on mobile when mobileView='map', always visible on desktop */}
          <aside aria-label="Map" className={mobileView === 'list' ? 'lg:block hidden' : 'hidden lg:block'}>
            {viewportStatus === 'error' && viewportErrorMessage && (
              <div
                role="alert"
                className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              >
                <span>{viewportErrorMessage}</span>
                <button
                  type="button"
                  onClick={retryViewportSearch}
                  className="font-semibold underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}
            <PlaceMap
              places={mapPlaces}
              center={mapCenter}
              zoom={10}
              selectedPlaceId={selectedPlaceId}
              onPlaceSelect={setSelectedPlaceId}
              onBoundsChange={handleBoundsChange}
              loading={viewportStatus === 'loading'}
              fitBounds={fitBoundsDone}
              onFitBoundsComplete={() => setFitBoundsDone(false)}
              isVisible={mobileView === 'map'}
              className="h-full min-h-[24rem]"
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
