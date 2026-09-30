// Unit tests for GET /api/places/bounds — route validation, rate-limiting
// passthrough, service wiring and response shape. The service layer is
// mocked, so no database access is required.

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/places/bounds/route';
import { placeService } from '@/features/places/services';
import { nearbyPlacesResponseSchema } from '@/features/places/nearby';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

jest.mock('@/features/places/services', () => ({
  placeService: {
    searchInBounds: jest.fn(),
  },
}));

const searchInBounds = placeService.searchInBounds as jest.MockedFunction<
  typeof placeService.searchInBounds
>;

function makeRequest(query: Record<string, string | number>): NextRequest {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => params.set(key, String(value)));
  return new NextRequest(`http://localhost/api/places/bounds?${params.toString()}`);
}

const VALID_VIEWPORT = { north: 13.2, south: 12.8, east: 77.8, west: 77.2 };

beforeEach(() => {
  searchInBounds.mockReset();
});

describe('GET /api/places/bounds', () => {
  it('returns 200 with places for a valid bounds request', async () => {
    const place = makeNearbyPlace();
    searchInBounds.mockResolvedValue(makeNearbyResponse([place]));

    const response = await GET(makeRequest(VALID_VIEWPORT));

    expect(response.status).toBe(200);
    expect(searchInBounds).toHaveBeenCalledWith({
      north: 13.2,
      south: 12.8,
      east: 77.8,
      west: 77.2,
      limit: 20,
      offset: 0,
      category: undefined,
      status: undefined,
      difficulty: undefined,
    });
  });

  it('returns the shared { data, pagination } response shape', async () => {
    searchInBounds.mockResolvedValue(
      makeNearbyResponse([makeNearbyPlace()], { limit: 20, offset: 0, count: 3 })
    );

    const response = await GET(makeRequest(VALID_VIEWPORT));
    const body = await response.json();

    expect(nearbyPlacesResponseSchema.safeParse(body).success).toBe(true);
    expect(body.pagination).toEqual({ limit: 20, offset: 0, count: 3 });
    expect(body.data[0]).toMatchObject({ name: 'Test Peak', visibilityLevel: 'PUBLIC_EXACT' });
  });

  it('passes category, status, difficulty and pagination filters through', async () => {
    searchInBounds.mockResolvedValue(makeNearbyResponse([]));

    const response = await GET(
      makeRequest({
        ...VALID_VIEWPORT,
        category: 'TREK',
        status: 'OPEN',
        difficulty: 3,
        limit: 5,
        offset: 10,
      })
    );

    expect(response.status).toBe(200);
    expect(searchInBounds).toHaveBeenCalledWith({
      north: 13.2,
      south: 12.8,
      east: 77.8,
      west: 77.2,
      limit: 5,
      offset: 10,
      category: 'TREK',
      status: 'OPEN',
      difficulty: 3,
    });
  });

  it('returns an empty result set as 200', async () => {
    searchInBounds.mockResolvedValue(makeNearbyResponse([], { count: 0 }));

    const response = await GET(makeRequest(VALID_VIEWPORT));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination.count).toBe(0);
    expect(searchInBounds).toHaveBeenCalledTimes(1);
  });

  it('rejects north <= south with 400 and does not call the service', async () => {
    const response = await GET(makeRequest({ north: 12.8, south: 13.2, east: 77.8, west: 77.2 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['north'] })])
    );
    expect(searchInBounds).not.toHaveBeenCalled();
  });

  it('rejects east <= west with 400', async () => {
    const response = await GET(makeRequest({ north: 13.2, south: 12.8, east: 77.2, west: 77.8 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['east'] })])
    );
    expect(searchInBounds).not.toHaveBeenCalled();
  });

  it('rejects out-of-range latitudes and longitudes with 400', async () => {
    const badLatitude = await GET(makeRequest({ north: -95, south: -96, east: 77.8, west: 77.2 }));
    expect(badLatitude.status).toBe(400);

    const badLongitude = await GET(makeRequest({ north: 13, south: 12, east: 200, west: 181 }));
    expect(badLongitude.status).toBe(400);

    expect(searchInBounds).not.toHaveBeenCalled();
  });

  it('rejects a missing bounds parameter with 400', async () => {
    const response = await GET(makeRequest({ north: 13.2, south: 12.8, east: 77.8 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['west'] })])
    );
  });

  it('rejects a limit above the maximum with 400', async () => {
    const response = await GET(makeRequest({ ...VALID_VIEWPORT, limit: 1000 }));

    expect(response.status).toBe(400);
    expect(searchInBounds).not.toHaveBeenCalled();
  });

  it('maps a service failure to a 500 without leaking internals', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    searchInBounds.mockRejectedValue(new Error('database exploded at SELECT ...'));

    const response = await GET(makeRequest(VALID_VIEWPORT));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('database exploded');

    consoleError.mockRestore();
  });
});
