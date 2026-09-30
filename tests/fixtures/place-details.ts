// Shared fixtures for place-details tests.
// Synthetic data only — never real production places.

import type { PlaceDetailResult } from '@/features/places/repositories';

export function makePlaceDetail(overrides: Partial<PlaceDetailResult> = {}): PlaceDetailResult {
  return {
    id: 'place-1',
    name: 'Test Peak',
    slug: 'test-peak',
    category: 'TREK',
    shortDescription: 'A steep climb above the city',
    description: 'A synthetic description used only in tests.',
    latitude: 13.0,
    longitude: 77.5,
    distanceMeters: 0,
    difficulty: 3,
    status: 'OPEN',
    trustLevel: 'VERIFIED',
    visibilityLevel: 'PUBLIC_EXACT',
    sources: [
      {
        id: 'source-1',
        name: 'Forest Department',
        type: 'OFFICIAL_GOVERNMENT',
        url: 'https://example.gov.in/test-peak',
      },
    ],
    ...overrides,
  };
}
