'use client';

// Discovery container — the only place that performs client-side data fetching.
// UI -> fetchNearbyPlaces() -> GET /api/places/nearby -> service -> repository -> PostGIS

import { useCallback, useState } from 'react';
import { roundCoordinate } from '@/lib/utils';
import {
  DEFAULT_RADIUS_METERS,
  DEFAULT_SEARCH_CENTER,
  SEARCH_RESULT_LIMIT,
  validateDiscoveryLocation,
} from '@/features/places/discovery';
import {
  NEARBY_ERROR_MESSAGES,
  NearbyApiError,
  fetchNearbyPlaces,
  type NearbyPlace,
} from '@/features/places/nearby';
import { placeCategorySchema, type PlaceCategory } from '@/lib/validation/schemas';
import { DiscoveryControls, type DiscoveryFormValues } from './DiscoveryControls';
import { DiscoveryHeader } from './DiscoveryHeader';
import { DiscoveryResults, type DiscoveryStatus } from './DiscoveryResults';
import type { DiscoveryOrigin } from './NearbyPlaceCard';
import { PlaceMap } from '@/components/map/PlaceMap';
import {
  SYNTHETIC_MAP_POINTS,
  SYNTHETIC_MAP_ZOOM,
  syntheticMapCenter,
} from '@/features/places/dev-map-fixtures';

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
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null);

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

  const runSearch = useCallback(async () => {
    const validated = validateDiscoveryLocation({
      latitude: values.latitude,
      longitude: values.longitude,
    });
    if (!validated.valid) {
      setFieldErrors(validated.fieldErrors);
      return;
    }

    setFieldErrors({});
    setLocationMessage(null);
    setErrorMessage(null);
    setStatus('loading');

    const parsedCategory = placeCategorySchema.safeParse(values.category);
    const difficulty = values.difficulty === '' ? Number.NaN : Number(values.difficulty);

    try {
      const response = await fetchNearbyPlaces({
        lat: validated.latitude,
        lng: validated.longitude,
        radiusMeters: values.radiusMeters,
        limit: SEARCH_RESULT_LIMIT,
        category: parsedCategory.success ? parsedCategory.data : undefined,
        difficulty:
          Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5
            ? difficulty
            : undefined,
      });
      setPlaces(response.data);
      setTotalCount(response.pagination.count);
      setSearchOrigin({ lat: validated.latitude, lng: validated.longitude });
      setStatus('success');
    } catch (error) {
      const code = error instanceof NearbyApiError ? error.code : 'http';
      setErrorMessage(NEARBY_ERROR_MESSAGES[code]);
      setStatus('error');
    }
  }, [values]);

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

        {/* Results + map column: map⇄viewport data wiring arrives in Phase 2C.2 */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <DiscoveryResults
            status={status}
            places={places}
            totalCount={totalCount}
            radiusMeters={values.radiusMeters}
            origin={searchOrigin}
            errorMessage={errorMessage}
            onRetry={runSearch}
          />

          {/* Phase 2C.1: synthetic markers prove the map foundation */}
          <aside aria-label="Map" className="hidden lg:block">
            <PlaceMap
              places={SYNTHETIC_MAP_POINTS}
              center={syntheticMapCenter()}
              zoom={SYNTHETIC_MAP_ZOOM}
              selectedPlaceId={selectedMapPlaceId}
              onPlaceSelect={setSelectedMapPlaceId}
              className="h-full min-h-[24rem]"
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
