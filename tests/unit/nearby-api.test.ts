// Unit tests for the nearby API client layer
// Covers request URL construction, response validation and error mapping

import {
  NEARBY_PLACES_ENDPOINT,
  NearbyApiError,
  buildNearbyPlacesUrl,
  fetchNearbyPlaces,
} from '@/features/places/nearby';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

const originalFetch = global.fetch;

describe('buildNearbyPlacesUrl', () => {
  it('builds the required query parameters with defaults', () => {
    expect(buildNearbyPlacesUrl({ lat: 12.9716, lng: 77.5946 })).toBe(
      `${NEARBY_PLACES_ENDPOINT}?lat=12.9716&lng=77.5946&radius=10000&limit=20&offset=0`
    );
  });

  it('includes radius, limit and offset when provided', () => {
    const url = buildNearbyPlacesUrl({
      lat: 13.0,
      lng: 77.5,
      radiusMeters: 25000,
      limit: 10,
      offset: 20,
    });
    expect(url).toContain('radius=25000');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('includes category and difficulty filters when provided', () => {
    const url = buildNearbyPlacesUrl({
      lat: 12.9716,
      lng: 77.5946,
      category: 'TREK',
      difficulty: 3,
    });
    expect(url).toContain('category=TREK');
    expect(url).toContain('difficulty=3');
  });

  it('omits optional filters when they are not provided', () => {
    const url = buildNearbyPlacesUrl({ lat: 1, lng: 2 });
    expect(url).not.toContain('category=');
    expect(url).not.toContain('difficulty=');
  });
});

describe('fetchNearbyPlaces', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('requests the nearby endpoint and returns validated data', async () => {
    const place = makeNearbyPlace();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeNearbyResponse([place]),
    });

    const result = await fetchNearbyPlaces({
      lat: 12.9716,
      lng: 77.5946,
      radiusMeters: 10000,
      category: 'TREK',
      difficulty: 3,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${NEARBY_PLACES_ENDPOINT}?lat=12.9716&lng=77.5946&radius=10000&limit=20&offset=0&category=TREK&difficulty=3`,
      expect.anything()
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Test Peak');
    expect(result.pagination.count).toBe(1);
  });

  it('maps a 429 response to a rate-limit error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).rejects.toMatchObject({
      name: 'NearbyApiError',
      code: 'rate_limited',
      status: 429,
    });
  });

  it('maps a 500 response to an http error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).rejects.toMatchObject({
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

    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('maps a network failure to a network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('rethrows abort errors instead of converting them', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).rejects.toBe(abortError);
  });

  it('throws NearbyApiError instances', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).rejects.toBeInstanceOf(NearbyApiError);
  });
});
