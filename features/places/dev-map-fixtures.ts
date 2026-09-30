// SYNTHETIC development fixtures for the Phase 2C.1 map foundation.
//
// These are NOT real destinations. The explore page renders them to prove
// marker rendering, selection and privacy handling before any viewport ⇄ API
// wiring exists. Phase 2C.2 replaces them with API-driven markers; this module
// is intended to be deleted (or moved under tests/) at that point.

import { toMapPlacePoint, type MapPlacePoint, type VisibilityLevelValue } from './map-places';

export interface SyntheticMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  visibilityLevel: VisibilityLevelValue;
}

/** Synthetic fixture set — one exact, one exact, one approximate (privacy path). */
export const SYNTHETIC_MAP_PLACES: SyntheticMapPlace[] = [
  {
    id: 'test-peak',
    name: 'Test Peak',
    latitude: 13.0,
    longitude: 77.5,
    visibilityLevel: 'PUBLIC_EXACT',
  },
  {
    id: 'second-hill',
    name: 'Second Hill',
    latitude: 13.08,
    longitude: 77.59,
    visibilityLevel: 'PUBLIC_EXACT',
  },
  {
    id: 'riverside-test-point',
    name: 'Riverside Test Point',
    latitude: 12.95,
    longitude: 77.48,
    visibilityLevel: 'PUBLIC_APPROXIMATE',
  },
];

/** Fixture points resolved through the central privacy mapper. */
export const SYNTHETIC_MAP_POINTS: MapPlacePoint[] = SYNTHETIC_MAP_PLACES.map(toMapPlacePoint);

/** Geographic centre of the fixture set — computed, never baked into the map component. */
export function syntheticMapCenter(): { latitude: number; longitude: number } {
  const plottable = SYNTHETIC_MAP_POINTS.filter((point) => point.location.kind !== 'unavailable');

  if (plottable.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  let latitudeSum = 0;
  let longitudeSum = 0;
  for (const point of plottable) {
    if (point.location.kind === 'unavailable') continue;
    latitudeSum += point.location.latitude;
    longitudeSum += point.location.longitude;
  }

  return {
    latitude: latitudeSum / plottable.length,
    longitude: longitudeSum / plottable.length,
  };
}

/** Initial zoom for the fixture set. */
export const SYNTHETIC_MAP_ZOOM = 10;
