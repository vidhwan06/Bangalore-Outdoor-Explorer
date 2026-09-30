// Client-side data access for GET /api/places/bounds
//
// UI (map viewport search in components/explore) -> this module
//   -> /api/places/bounds -> placeService -> place repository -> PostgreSQL/PostGIS
//
// Shares the nearby endpoint's Zod response contract ({ data, pagination })
// and error mapping via requestPlacesJson, so both list clients behave
// identically. Components never talk to Prisma or PostGIS directly.

import { requestPlacesJson, type NearbyPlacesResponse } from './nearby';
import type { PlaceCategory, PlaceStatus } from '@/lib/validation/schemas';

export const BOUNDS_PLACES_ENDPOINT = '/api/places/bounds';

/**
 * Serializable map viewport in WGS84 degrees.
 * Produced by the map component from Leaflet's moveend event; consumed by
 * this client. Never carries Leaflet-specific objects.
 */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface BoundsPlacesQuery extends MapBounds {
  limit?: number;
  offset?: number;
  category?: PlaceCategory;
  status?: PlaceStatus;
  difficulty?: number;
}

/** Builds the request URL for GET /api/places/bounds. Pure — used by tests. */
export function buildBoundsPlacesUrl(query: BoundsPlacesQuery): string {
  const params = new URLSearchParams();
  params.set('north', String(query.north));
  params.set('south', String(query.south));
  params.set('east', String(query.east));
  params.set('west', String(query.west));
  params.set('limit', String(query.limit ?? 20));
  params.set('offset', String(query.offset ?? 0));

  if (query.category) {
    params.set('category', query.category);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.difficulty !== undefined) {
    params.set('difficulty', String(query.difficulty));
  }

  return `${BOUNDS_PLACES_ENDPOINT}?${params.toString()}`;
}

/**
 * Fetches the places inside a map viewport and validates the response.
 * Throws NearbyApiError (shared contract) for network, HTTP, rate-limit
 * and payload failures.
 */
export async function fetchPlacesInBounds(
  query: BoundsPlacesQuery,
  init?: RequestInit
): Promise<NearbyPlacesResponse> {
  return requestPlacesJson(buildBoundsPlacesUrl(query), init);
}
