// Unit tests for the place-detail client contract (features/places/detail.ts).
//
// No database: fetch is mocked. This file pins the response schema, the error
// mapping and the URL builder — the pieces the frontend integrates against. The
// route and the database are covered by tests/integration/api-place-detail-db.test.ts.

import {
  buildPlaceDetailUrl,
  fetchPlaceBySlug,
  placeDetailResponseSchema,
  placeDetailSchema,
  PlaceDetailError,
  PLACE_DETAIL_ENDPOINT,
  PLACE_DETAIL_ERROR_MESSAGES,
  type PlaceDetailErrorCode,
} from '@/features/places/detail';
import { nearbyPlaceSchema } from '@/features/places/nearby';
import { placePhotoSchema, placeSourceSchema } from '@/lib/validation/schemas';
import { makePlaceDetail } from '../fixtures/place-details';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('placeDetailSchema', () => {
  const detail = makePlaceDetail();

  it('accepts a complete place detail', () => {
    expect(placeDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('accepts a place with no description, sources or photos', () => {
    const parsed = placeDetailSchema.safeParse({
      ...detail,
      description: null,
      sources: [],
      photos: [],
    });
    expect(parsed.success).toBe(true);
  });

  it('extends the list contract, so shared fields stay identical', () => {
    // The detail payload is a superset: every list field keeps its type.
    expect(nearbyPlaceSchema.safeParse(detail).success).toBe(true);

    const listKeys = Object.keys(nearbyPlaceSchema.shape);
    const detailKeys = Object.keys(placeDetailSchema.shape);
    expect(detailKeys).toEqual(expect.arrayContaining(listKeys));
    expect(detailKeys.length).toBeGreaterThan(listKeys.length);
  });

  it('reuses the shared photo and source schemas rather than redefining them', () => {
    expect(placeDetailSchema.shape.photos).toBeDefined();
    expect(placeDetailSchema.shape.sources).toBeDefined();
    expect(
      placePhotoSchema.safeParse({
        id: 'p1',
        placeId: 'place-1',
        url: 'https://example.com/a.jpg',
        thumbnailUrl: null,
        caption: null,
        license: 'CC_BY_SA',
        attribution: 'Jane Doe',
        altText: 'A summit',
        sourceUrl: null,
        photographerName: null,
        isPrimary: true,
        sortOrder: 0,
      }).success
    ).toBe(true);
    expect(
      placeSourceSchema.safeParse({
        id: 's1',
        name: 'Forest Department',
        type: 'OFFICIAL_GOVERNMENT',
        url: 'https://example.gov.in',
      }).success
    ).toBe(true);
  });

  it('rejects an invalid source type', () => {
    const parsed = placeDetailSchema.safeParse({
      ...detail,
      sources: [{ id: 's1', name: 'X', type: 'NOT_A_SOURCE_TYPE', url: null }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-http photo url', () => {
    const parsed = placeDetailSchema.safeParse({
      ...detail,
      photos: [
        {
          id: 'p1',
          placeId: 'place-1',
          url: 'data:image/png;base64,AAAA',
          thumbnailUrl: null,
          caption: null,
          license: 'CC0',
          attribution: 'Someone',
          altText: 'A view',
          sourceUrl: null,
          photographerName: null,
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('requires the { data } envelope', () => {
    expect(placeDetailResponseSchema.safeParse({ data: detail }).success).toBe(true);
    // A bare place is not a valid response body.
    expect(placeDetailResponseSchema.safeParse(detail).success).toBe(false);
    // The list envelope is not interchangeable here.
    expect(placeDetailResponseSchema.safeParse({ data: [detail], pagination: {} }).success).toBe(
      false
    );
  });
});

describe('buildPlaceDetailUrl', () => {
  it('targets the documented endpoint', () => {
    expect(PLACE_DETAIL_ENDPOINT).toBe('/api/places');
    expect(buildPlaceDetailUrl('nandi-hills')).toBe('/api/places/nandi-hills');
  });

  it('percent-encodes the slug so it cannot escape the path', () => {
    expect(buildPlaceDetailUrl('a b')).toBe('/api/places/a%20b');
    expect(buildPlaceDetailUrl('a/b')).toBe('/api/places/a%2Fb');
    expect(buildPlaceDetailUrl('a?b=1')).toBe('/api/places/a%3Fb%3D1');
    expect(buildPlaceDetailUrl('a#b')).toBe('/api/places/a%23b');
    expect(buildPlaceDetailUrl('../admin')).toBe('/api/places/..%2Fadmin');
  });
});

describe('fetchPlaceBySlug', () => {
  const body = { data: makePlaceDetail() };

  it('returns the validated payload on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(body));

    const result = await fetchPlaceBySlug('test-peak');

    expect(result.data.slug).toBe('test-peak');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/places/test-peak');
  });

  it('maps a 404 to the not_found code', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ error: 'Place not found', code: 'NOT_FOUND' }, 404)
    );

    await expect(fetchPlaceBySlug('missing')).rejects.toMatchObject({
      name: 'PlaceDetailError',
      code: 'not_found',
      status: 404,
    });
  });

  it('maps a 429 to the rate_limited code', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({}, 429));

    await expect(fetchPlaceBySlug('test-peak')).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });

  it('maps a network failure to the network code', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(fetchPlaceBySlug('test-peak')).rejects.toMatchObject({ code: 'network' });
  });

  it('rethrows an abort so callers can ignore a cancelled request', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abort);

    await expect(fetchPlaceBySlug('test-peak')).rejects.toBe(abort);
  });

  it('maps a 400 to the http code with the status attached', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ error: 'Validation failed', issues: [] }, 400)
    );

    await expect(fetchPlaceBySlug('BAD SLUG')).rejects.toMatchObject({
      code: 'http',
      status: 400,
    });
  });

  it('maps a non-JSON body to invalid_response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('<html>oops</html>', { status: 200 })
    );

    await expect(fetchPlaceBySlug('test-peak')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('rejects a payload that breaks the contract', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ data: { ...body.data, category: 'NOT_A_CATEGORY' } })
    );

    await expect(fetchPlaceBySlug('test-peak')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('rejects a missing data envelope', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ place: body.data }));

    await expect(fetchPlaceBySlug('test-peak')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('throws PlaceDetailError instances', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({}, 404));

    await expect(fetchPlaceBySlug('missing')).rejects.toBeInstanceOf(PlaceDetailError);
  });
});

describe('PLACE_DETAIL_ERROR_MESSAGES', () => {
  it('has a message for every error code', () => {
    const codes: PlaceDetailErrorCode[] = [
      'network',
      'http',
      'rate_limited',
      'invalid_response',
      'not_found',
    ];
    for (const code of codes) {
      expect(PLACE_DETAIL_ERROR_MESSAGES[code]).toBeTruthy();
    }
  });

  it('gives not_found a distinct, user-facing message', () => {
    expect(PLACE_DETAIL_ERROR_MESSAGES.not_found).toMatch(/could not find/i);
    expect(PLACE_DETAIL_ERROR_MESSAGES.not_found).not.toMatch(/not_found/);
  });

  it('never leaks an internal detail to the user', () => {
    for (const message of Object.values(PLACE_DETAIL_ERROR_MESSAGES)) {
      expect(message).not.toMatch(/SELECT|Prisma|postgres|stack|relation/i);
    }
  });
});
