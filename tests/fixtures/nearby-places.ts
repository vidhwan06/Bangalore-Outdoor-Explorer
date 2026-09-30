// Shared fixtures for nearby/discovery tests.
// Synthetic data only — never real production places.

import type { NearbyPlace, NearbyPlacesResponse } from '@/features/places/nearby';

export function makeNearbyPlace(overrides: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    id: 'place-1',
    name: 'Test Peak',
    slug: 'test-peak',
    category: 'TREK',
    shortDescription: 'A steep climb above the city',
    latitude: 13.0,
    longitude: 77.5,
    distanceMeters: 1234,
    difficulty: 3,
    status: 'OPEN',
    trustLevel: 'VERIFIED',
    visibilityLevel: 'PUBLIC_EXACT',
    ...overrides,
  };
}

export function makeNearbyResponse(
  places: NearbyPlace[],
  pagination: Partial<NearbyPlacesResponse['pagination']> = {}
): NearbyPlacesResponse {
  const limit = pagination.limit ?? 20;
  const offset = pagination.offset ?? 0;
  const count = pagination.count ?? places.length;
  return {
    data: places,
    pagination: {
      limit,
      offset,
      count,
      hasMore: pagination.hasMore ?? (offset + limit < count),
      ...pagination,
    },
  };
}
