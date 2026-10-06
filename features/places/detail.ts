// Client-side data access for GET /api/places/[slug]
//
// UI -> this module -> /api/places/[slug] -> placeService
//   -> place repository -> PostgreSQL/PostGIS
//
// Follows the same conventions as the list endpoints (features/places/nearby.ts
// and bounds.ts): a Zod-validated response contract, one fetch helper, and a
// message map keyed by error code. Components never talk to Prisma or PostGIS
// directly.
//
// The route serves one place, so there is no pagination object — the envelope is
// { data } only. That is the single deliberate difference from the
// { data, pagination } envelope the list endpoints use.
//
// The error type is separate from NearbyApiError on purpose: a detail lookup has
// a distinct 404 outcome, and widening NearbyApiErrorCode would have forced a
// dead 'not_found' message onto the map and discovery clients. Keeping it here
// leaves every existing places client untouched.

import { z } from 'zod';
import { placePhotoSchema, placeSourceSchema } from '@/lib/validation/schemas';
import { nearbyPlaceSchema, NEARBY_ERROR_MESSAGES, type NearbyApiErrorCode } from './nearby';

export const PLACE_DETAIL_ENDPOINT = '/api/places';

/**
 * A place as returned by the detail endpoint.
 *
 * The scalar fields are exactly those every place query selects, so this is
 * `nearbyPlaceSchema` extended with the detail-only fields rather than a second,
 * parallel definition. Extending the shared base keeps the list and detail
 * contracts from drifting: a field added to PlaceResult has to be added here too.
 */
export const placeDetailSchema = nearbyPlaceSchema.extend({
  /** Long-form description. Null when the place has none. */
  description: z.string().nullable(),
  /** Official/verified sources citing this place, ordered by name. */
  sources: z.array(placeSourceSchema),
  /**
   * All photos for the place, primary-first, with provenance and alt text.
   * Empty when the place has no photos — never null.
   */
  photos: z.array(placePhotoSchema),
});

/** Response envelope for the detail endpoint. */
export const placeDetailResponseSchema = z.object({
  data: placeDetailSchema,
});

export type PlaceDetail = z.infer<typeof placeDetailSchema>;
export type PlaceDetailResponse = z.infer<typeof placeDetailResponseSchema>;

/**
 * Failure modes for the detail endpoint: the four shared transport failures plus
 * a 404, which is the expected outcome for an unknown or non-public slug.
 */
export type PlaceDetailErrorCode = NearbyApiErrorCode | 'not_found';

/** User-facing message for each failure mode. */
export const PLACE_DETAIL_ERROR_MESSAGES: Record<PlaceDetailErrorCode, string> = {
  ...NEARBY_ERROR_MESSAGES,
  not_found: 'We could not find that place. It may have been removed or is not public.',
};

/** Error raised by the detail client — safe to surface a mapped message for. */
export class PlaceDetailError extends Error {
  constructor(
    message: string,
    public code: PlaceDetailErrorCode,
    public status?: number
  ) {
    super(message);
    this.name = 'PlaceDetailError';
  }
}

/** Request URL for a slug. Pure — used by tests. */
export function buildPlaceDetailUrl(slug: string): string {
  return `${PLACE_DETAIL_ENDPOINT}/${encodeURIComponent(slug)}`;
}

/**
 * Fetches one place by slug and validates it against the response contract.
 *
 * Throws PlaceDetailError for network, rate-limit, 404, HTTP and payload
 * failures. The 404 is a normal outcome here rather than an exception worth
 * special-casing upstream: a private or removed place is indistinguishable from
 * one that never existed, which is what the repository's visibility filter
 * guarantees.
 */
export async function fetchPlaceBySlug(
  slug: string,
  init?: RequestInit
): Promise<PlaceDetailResponse> {
  let response: Response;
  try {
    response = await fetch(buildPlaceDetailUrl(slug), {
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new PlaceDetailError('Network request failed', 'network');
  }

  if (response.status === 429) {
    throw new PlaceDetailError('Rate limit exceeded', 'rate_limited', 429);
  }
  if (response.status === 404) {
    throw new PlaceDetailError('Place not found', 'not_found', 404);
  }
  if (!response.ok) {
    throw new PlaceDetailError(
      `Request failed with status ${response.status}`,
      'http',
      response.status
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PlaceDetailError('Response was not valid JSON', 'invalid_response', response.status);
  }

  const parsed = placeDetailResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PlaceDetailError(
      'Response did not match the expected shape',
      'invalid_response',
      response.status
    );
  }

  return parsed.data;
}
