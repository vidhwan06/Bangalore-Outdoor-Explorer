// Client-side data access for GET /api/places/nearby
//
// UI (components/explore) -> this module -> /api/places/nearby -> placeService
//   -> place repository -> PostgreSQL/PostGIS
//
// Components never talk to Prisma or construct spatial queries — they call
// fetchNearbyPlaces() and receive a Zod-validated response.

import { z } from 'zod';
import {
  placeCategorySchema,
  placeStatusSchema,
  trustLevelSchema,
  visibilityLevelSchema,
  type PlaceCategory,
} from '@/lib/validation/schemas';

export const NEARBY_PLACES_ENDPOINT = '/api/places/nearby';

/**
 * Shape of a place returned by the nearby endpoint (repository PlaceResult),
 * validated at the client boundary before it reaches the UI.
 */
export const nearbyPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  category: placeCategorySchema,
  shortDescription: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  distanceMeters: z.number(),
  difficulty: z.number().int().min(1).max(5).nullable(),
  status: placeStatusSchema,
  trustLevel: trustLevelSchema,
  visibilityLevel: visibilityLevelSchema,
});

export const nearbyPlacesResponseSchema = z.object({
  data: z.array(nearbyPlaceSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    count: z.number(),
  }),
});

export type NearbyPlace = z.infer<typeof nearbyPlaceSchema>;
export type NearbyPlacesResponse = z.infer<typeof nearbyPlacesResponseSchema>;

export interface NearbyPlacesQuery {
  lat: number;
  lng: number;
  /** Radius in metres (API maximum: 50000). */
  radiusMeters?: number;
  limit?: number;
  offset?: number;
  category?: PlaceCategory;
  difficulty?: number;
}

export type NearbyApiErrorCode = 'network' | 'http' | 'rate_limited' | 'invalid_response';

/** Error raised by the nearby client — safe to surface a mapped message for. */
export class NearbyApiError extends Error {
  constructor(
    message: string,
    public code: NearbyApiErrorCode,
    public status?: number
  ) {
    super(message);
    this.name = 'NearbyApiError';
  }
}

/** User-facing message for each failure mode. */
export const NEARBY_ERROR_MESSAGES: Record<NearbyApiErrorCode, string> = {
  network: 'Could not reach the server. Check your connection and try again.',
  http: 'Something went wrong while searching for places. Please try again.',
  rate_limited: 'Too many searches in a short time. Wait a moment and try again.',
  invalid_response: 'The server returned an unexpected response. Please try again.',
};

/** Builds the request URL for GET /api/places/nearby. Pure — used by tests. */
export function buildNearbyPlacesUrl(query: NearbyPlacesQuery): string {
  const params = new URLSearchParams();
  params.set('lat', String(query.lat));
  params.set('lng', String(query.lng));
  params.set('radius', String(query.radiusMeters ?? 10000));
  params.set('limit', String(query.limit ?? 20));
  params.set('offset', String(query.offset ?? 0));

  if (query.category) {
    params.set('category', query.category);
  }
  if (query.difficulty !== undefined) {
    params.set('difficulty', String(query.difficulty));
  }

  return `${NEARBY_PLACES_ENDPOINT}?${params.toString()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Shared GET helper for the place-list endpoints (nearby + bounds).
 * Performs the request, maps rate-limit/HTTP/network/payload failures to
 * NearbyApiError and validates the { data, pagination } response contract.
 */
export async function requestPlacesJson(
  url: string,
  init?: RequestInit
): Promise<NearbyPlacesResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new NearbyApiError('Network request failed', 'network');
  }

  if (response.status === 429) {
    throw new NearbyApiError('Rate limit exceeded', 'rate_limited', 429);
  }
  if (!response.ok) {
    throw new NearbyApiError(
      `Request failed with status ${response.status}`,
      'http',
      response.status
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new NearbyApiError('Response was not valid JSON', 'invalid_response', response.status);
  }

  const parsed = nearbyPlacesResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new NearbyApiError(
      'Response did not match the expected shape',
      'invalid_response',
      response.status
    );
  }

  return parsed.data;
}

/**
 * Fetches places near a point from the API and validates the response.
 * Throws NearbyApiError for network, HTTP, rate-limit and payload failures.
 */
export async function fetchNearbyPlaces(
  query: NearbyPlacesQuery,
  init?: RequestInit
): Promise<NearbyPlacesResponse> {
  return requestPlacesJson(buildNearbyPlacesUrl(query), init);
}
