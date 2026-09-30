// Unit tests for the bounds API client layer
// Covers request URL construction, shared response validation and error mapping

import {
  BOUNDS_PLACES_ENDPOINT,
  buildBoundsPlacesUrl,
  fetchPlacesInBounds,
} from '@/features/places/bounds';
import { NearbyApiError } from '@/features/places/nearby';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

const originalFetch = global.fetch;

describe('buildBoundsPlacesUrl', () => {
  it('builds the required bounds parameters with defaults', () => {
    expect(buildBoundsPlacesUrl({ north: 13.2, south: 12.8, east: 77.8, west: 77.2 })).toBe(
      `${BOUNDS_PLACES_ENDPOINT}?north=13.2&south=12.8&east=77.8&west=77.2&limit=20&offset=0`
    );
  });

  it('includes limit and offset when provided', () => {
    const url = buildBoundsPlacesUrl({
      north: 13,
      south: 12,
      east: 78,
      west: 77,
      limit: 5,
      offset: 10,
    });
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
  });

  it('includes category, status and difficulty filters when provided', () => {
    const url = buildBoundsPlacesUrl({
      north: 13,
      south: 12,
      east: 78,
      west: 77,
      category: 'TREK',
      status: 'OPEN',
      difficulty: 3,
    });
    expect(url).toContain('category=TREK');
    expect(url).toContain('status=OPEN');
    expect(url).toContain('difficulty=3');
  });

  it('omits optional filters when they are not provided', () => {
    const url = buildBoundsPlacesUrl({ north: 1, south: 0, east: 2, west: 1 });
    expect(url).not.toContain('category=');
    expect(url).not.toContain('status=');
    expect(url).not.toContain('difficulty=');
  });
});

describe('fetchPlacesInBounds', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('requests the bounds endpoint and returns validated data', async () => {
    const place = makeNearbyPlace();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeNearbyResponse([place]),
    });

    const result = await fetchPlacesInBounds({
      north: 13.1,
      south: 12.9,
      east: 77.7,
      west: 77.4,
      category: 'TREK',
      difficulty: 3,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${BOUNDS_PLACES_ENDPOINT}?north=13.1&south=12.9&east=77.7&west=77.4&limit=20&offset=0&category=TREK&difficulty=3`,
      expect.anything()
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Test Peak');
    expect(result.pagination.count).toBe(1);
  });

  it('maps a 429 response to a rate-limit error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    await expect(
      fetchPlacesInBounds({ north: 1, south: 0, east: 2, west: 1 })
    ).rejects.toMatchObject({
      name: 'NearbyApiError',
      code: 'rate_limited',
      status: 429,
    });
  });

  it('maps a 500 response to an http error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(
      fetchPlacesInBounds({ north: 1, south: 0, east: 2, west: 1 })
    ).rejects.toMatchObject({
      code: 'http',
      status: 500,
    });
  });

  it('maps a payload that does not match the schema to an invalid-response error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    });

    await expect(
      fetchPlacesInBounds({ north: 1, south: 0, east: 2, west: 1 })
    ).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('maps a network failure to a network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetchPlacesInBounds({ north: 1, south: 0, east: 2, west: 1 })
    ).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('rethrows abort errors instead of converting them', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    await expect(fetchPlacesInBounds({ north: 1, south: 0, east: 2, west: 1 })).rejects.toBe(
      abortError
    );
  });

  it('throws NearbyApiError instances', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetchPlacesInBounds({ north: 1, south: 0, east: 2, west: 1 })
    ).rejects.toBeInstanceOf(NearbyApiError);
  });
});
