// Synthetic map fixtures for component tests.
//
// Built from API result fixtures (makeNearbyPlace) through the REAL privacy
// mapper (toMapPlacePoint), so tests exercise the same production path the
// explore page uses: PlaceResult -> toMapPlacePoint -> MapPlacePoint.
// Test-only data — never real production places.

import { toMapPlacePoint, type MapPlacePoint } from '@/features/places/map-places';
import { makeNearbyPlace } from './nearby-places';

/** Synthetic API rows — one exact, one exact, one approximate (privacy path). */
export function makeMapPlaceRows() {
  return [
    makeNearbyPlace({ id: 'test-peak', name: 'Test Peak', slug: 'test-peak' }),
    makeNearbyPlace({
      id: 'second-hill',
      name: 'Second Hill',
      slug: 'second-hill',
      latitude: 13.08,
      longitude: 77.59,
    }),
    makeNearbyPlace({
      id: 'riverside-test-point',
      name: 'Riverside Test Point',
      slug: 'riverside-test-point',
      latitude: 12.95,
      longitude: 77.48,
      visibilityLevel: 'PUBLIC_APPROXIMATE',
    }),
  ];
}

/** Fixture points resolved through the central privacy mapper. */
export const MAP_TEST_POINTS: MapPlacePoint[] = makeMapPlaceRows().map(toMapPlacePoint);
