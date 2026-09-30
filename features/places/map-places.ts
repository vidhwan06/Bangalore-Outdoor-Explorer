// Central place → map conversion boundary.
//
// PRIVACY: this module is the single place where a place's stored coordinates
// are turned into something the map is allowed to plot.
//   - PUBLIC_EXACT        → exact coordinates may be plotted
//   - PUBLIC_APPROXIMATE  → only an intentionally coarse point (~1.1 km grid)
//   - anything else / no coordinates → never plotted at all
// The map component never sees visibility levels — it only receives already
// resolved locations, so the rule above cannot be bypassed from the UI.

import type { z } from 'zod';
import { visibilityLevelSchema } from '@/lib/validation/schemas';

export type VisibilityLevelValue = z.infer<typeof visibilityLevelSchema>;

/** Where the map is allowed to place a marker for a destination. */
export type MapPlaceLocation =
  | { kind: 'exact'; latitude: number; longitude: number }
  | { kind: 'approximate'; latitude: number; longitude: number }
  | { kind: 'unavailable' };

/** A marker-ready place. Only ever contains map-safe location data. */
export interface MapPlacePoint {
  id: string;
  name: string;
  location: MapPlaceLocation;
}

/** Minimum data required to resolve a place's map location. */
export interface PlaceLocationSource {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  /** Raw value from DB/API — validated against the visibility enum below. */
  visibilityLevel: string;
}

/**
 * Rounds a coordinate to 0.01° (~1.1 km).
 * A point on this grid can never pinpoint a private location.
 */
export function toApproximateCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolves the map-safe location for a place.
 * Non-public visibility levels and missing coordinates resolve to
 * `unavailable` — the map must never invent or expose a point for them.
 */
export function toMapPlacePoint(place: PlaceLocationSource): MapPlacePoint {
  const { id, name, latitude, longitude } = place;

  const hasCoordinates =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);

  if (!hasCoordinates) {
    return { id, name, location: { kind: 'unavailable' } };
  }

  // Zod at the boundary: an unrecognised level is treated as non-public.
  const parsedVisibility = visibilityLevelSchema.safeParse(place.visibilityLevel);
  if (!parsedVisibility.success) {
    return { id, name, location: { kind: 'unavailable' } };
  }

  if (parsedVisibility.data === 'PUBLIC_EXACT') {
    return { id, name, location: { kind: 'exact', latitude, longitude } };
  }

  if (parsedVisibility.data === 'PUBLIC_APPROXIMATE') {
    return {
      id,
      name,
      location: {
        kind: 'approximate',
        latitude: toApproximateCoordinate(latitude),
        longitude: toApproximateCoordinate(longitude),
      },
    };
  }

  // VERIFIED_COMMUNITY_ONLY / MODERATOR_ONLY / PRIVATE are never public map data.
  return { id, name, location: { kind: 'unavailable' } };
}
