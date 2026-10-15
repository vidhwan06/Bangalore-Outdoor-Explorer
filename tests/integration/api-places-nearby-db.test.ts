// Integration tests for the Places API routes against the REAL database.
//
// Existing coverage splits in two and misses the seam between them:
//   * tests/unit/nearby-api.test.ts + api-places-bounds.test.ts mock the service
//     and exercise the route handler (status codes, rate-limit headers, wiring).
//   * tests/integration/api-places-nearby.test.ts calls the service directly,
//     bypassing the route handler entirely.
// Neither runs the route handler against the real SQL. These tests call the
// actual exported GET handlers, so validation, service wiring, the repository's
// PostGIS query and the response contract are all exercised end to end.
//
// Real imported places (data/places.json) are used as the subject. Rows created
// here are namespaced under "test-" and removed in afterAll.

import { NextRequest } from 'next/server';
import { GET as nearbyGET } from '@/app/api/places/nearby/route';
import { GET as boundsGET } from '@/app/api/places/bounds/route';
import { nearbyPlacesResponseSchema } from '@/features/places/nearby';
import { prisma } from '@/lib/db/prisma';
import { rateLimiters } from '@/lib/security';
import { insertTestPlace, deleteTestPlaces, purgeTestPlaces } from '@/tests/db-setup';

/**
 * The search rate limiter keys on `request.ip`, which NextRequest only populates
 * behind a real server, so every in-process request shares the single
 * `anonymous` bucket. At 30 requests/minute a database-backed suite exhausts it
 * long before it finishes, and unrelated assertions would fail with 429.
 *
 * So the limiter is replaced with a pass-through that mirrors its real response
 * shape (headers included, which several tests assert on). The 429 path and the
 * real limiter are still covered by tests/unit/api-places-*.test.ts and
 * tests/integration/api-places-rate-limit.test.ts.
 */
jest.mock('@/lib/security', () => {
  const actual = jest.requireActual('@/lib/security');
  return {
    ...actual,
    rateLimiters: {
      ...actual.rateLimiters,
      search: jest.fn(async () => ({
        allowed: true,
        remaining: 29,
        resetAt: Date.now() + 60_000,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '29',
          'X-RateLimit-Reset': Math.ceil((Date.now() + 60_000) / 1000).toString(),
        },
      })),
    },
  };
});

jest.setTimeout(300_000);

const BENGALURU = { lat: 12.9716, lng: 77.5946 } as const;

/** The service layer's documented maximum search radius. */
const MAX_RADIUS_METERS = 50000;

/** A real place far enough out to be excluded at the service's radius cap. */
const SEEDED_BEYOND_SERVICE_MAX = 'chunchi-falls';

/** A real place comfortably inside the cap. */
const SEEDED_WITHIN_SERVICE_MAX = 'nandi-hills';

const SEEDED_SLUGS = [
  'nandi-hills',
  'skandagiri',
  'savandurga-hill',
  'makalidurga',
  'ramadevara-betta',
  'devarayanadurga',
  'anthargange',
  'chunchi-falls',
] as const;

const created: string[] = [];

// The page-walk assertions depend on the result set staying fixed between
// requests, so any fixture orphaned by an interrupted run must go first.
beforeAll(async () => {
  await prisma.$connect();
  await purgeTestPlaces();
});

afterAll(async () => {
  await deleteTestPlaces(created);
  // Reconnect so subsequent test files sharing this singleton can use it.
  await prisma.$connect();
});

function makeRequest(path: string, query: Record<string, string | number>): NextRequest {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  return new NextRequest(`http://localhost${path}?${params.toString()}`);
}

function nearbyRequest(query: Record<string, string | number>): NextRequest {
  return makeRequest('/api/places/nearby', query);
}

function boundsRequest(query: Record<string, string | number>): NextRequest {
  return makeRequest('/api/places/bounds', query);
}

/** True when a body looks like an error rather than a results payload. */
function isErrorBody(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'error' in (body as Record<string, unknown>);
}

describe('GET /api/places/nearby (real database)', () => {
  describe('successful responses', () => {
    it('returns 200 and a contract-valid body for a valid request', async () => {
      const response = await nearbyGET(nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS }));

      expect(response.status).toBe(200);
      const body = await response.json();

      const parsed = nearbyPlacesResponseSchema.safeParse(body);
      expect(
        parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      ).toEqual([]);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('includes a seeded place in the results with a PostGIS distance', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
      );
      const body = await response.json();

      const seeded = body.data.find((p: { slug: string }) => p.slug === SEEDED_WITHIN_SERVICE_MAX);
      expect(seeded).toBeDefined();
      expect(typeof seeded.distanceMeters).toBe('number');
      expect(seeded.distanceMeters).toBeGreaterThan(0);
      expect(seeded.distanceMeters).toBeLessThanOrEqual(MAX_RADIUS_METERS);
    });

    it('exposes seeded coordinates as numbers on the correct axis', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
      );
      const body = await response.json();

      for (const place of body.data as Array<{
        slug: string;
        latitude: number;
        longitude: number;
      }>) {
        expect(typeof place.latitude).toBe('number');
        expect(typeof place.longitude).toBe('number');
        // Bengaluru sits near 12.97N, 77.59E. Swapped axes would land longitude
        // in the 10-16 band, so these bounds prove the order.
        expect(place.longitude).toBeGreaterThan(70);
        expect(place.longitude).toBeLessThan(80);
        expect(place.latitude).toBeGreaterThan(10);
        expect(place.latitude).toBeLessThan(16);
      }
    });

    it('surfaces seeded enum and trust fields unchanged', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
      );
      const body = await response.json();

      const seeded = body.data.find((p: { slug: string }) => p.slug === SEEDED_WITHIN_SERVICE_MAX);
      expect(seeded).toBeDefined();

      const raw = await prisma.$queryRawUnsafe<
        { category: string; status: string; trustLevel: string; visibilityLevel: string }[]
      >(
        `SELECT category::text, status::text, "trustLevel"::text, "visibilityLevel"::text
           FROM "Place" WHERE slug = $1`,
        SEEDED_WITHIN_SERVICE_MAX
      );

      expect(seeded.category).toBe(raw[0].category);
      expect(seeded.status).toBe(raw[0].status);
      expect(seeded.trustLevel).toBe(raw[0].trustLevel);
      expect(seeded.visibilityLevel).toBe(raw[0].visibilityLevel);
    });

    it('returns pagination metadata consistent with the data', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 3, offset: 0 })
      );
      const body = await response.json();

      expect(body.pagination).toMatchObject({ limit: 3, offset: 0 });
      expect(body.data.length).toBeLessThanOrEqual(3);
      expect(body.pagination.count).toBeGreaterThanOrEqual(body.data.length);
      expect(typeof body.pagination.count).toBe('number');
      expect(typeof body.pagination.hasMore).toBe('boolean');
    });

    it('paginates without repeating or dropping rows', async () => {
      // Fetch the full set first so the page walk can be compared against it.
      const all = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100, offset: 0 })
      );
      const allBody = await all.json();
      const allSlugs = allBody.data.map((p: { slug: string }) => p.slug);
      const total = allBody.pagination.count;

      const walked: string[] = [];
      for (let offset = 0; offset <= total; offset += 2) {
        const page = await nearbyGET(
          nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 2, offset })
        );
        const body = await page.json();
        walked.push(...body.data.map((p: { slug: string }) => p.slug));
      }

      // No row may appear on two pages, and none may be skipped.
      expect(new Set(walked).size).toBe(walked.length);
      expect(walked.sort()).toEqual(allSlugs.sort());
    });

    it('orders results by ascending distance across pages', async () => {
      const first = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
      );
      const body = await first.json();
      const distances = body.data.map((p: { distanceMeters: number }) => p.distanceMeters);

      expect(distances.length).toBeGreaterThan(1);
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
      }
    });

    it('applies defaults when optional parameters are omitted', async () => {
      const response = await nearbyGET(nearbyRequest({ ...BENGALURU }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pagination).toMatchObject({ limit: 20, offset: 0 });
    });
  });

  describe('filtering', () => {
    it('filters by category', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, category: 'TREK', limit: 100 })
      );
      const body = await response.json();

      expect(body.data.length).toBeGreaterThan(0);
      for (const place of body.data as Array<{ category: string }>) {
        expect(place.category).toBe('TREK');
      }
    });

    it('filters by status', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, status: 'OPEN', limit: 100 })
      );
      const body = await response.json();

      for (const place of body.data as Array<{ status: string }>) {
        expect(place.status).toBe('OPEN');
      }
    });

    it('filters by difficulty', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, difficulty: 2, limit: 100 })
      );
      const body = await response.json();

      for (const place of body.data as Array<{ difficulty: number | null }>) {
        expect(place.difficulty).toBe(2);
      }
    });

    it('honours the radius ceiling for a place just outside it', async () => {
      const inside = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
      );
      const insideBody = await inside.json();
      const outside = await nearbyGET(nearbyRequest({ ...BENGALURU, radius: 1000, limit: 100 }));
      const outsideBody = await outside.json();

      expect(insideBody.data.map((p: { slug: string }) => p.slug)).toContain(
        SEEDED_WITHIN_SERVICE_MAX
      );
      // Chunchi Falls is ~60km out, so it is only reachable by a radius the
      // endpoint allows but the query itself would exclude.
      expect(outsideBody.data.map((p: { slug: string }) => p.slug)).not.toContain(
        SEEDED_BEYOND_SERVICE_MAX
      );
    });

    it('never returns non-public places', async () => {
      const slug = await insertTestPlace({
        name: 'API Restricted Test Place',
        slug: 'test-api-restricted',
        latitude: BENGALURU.lat,
        longitude: BENGALURU.lng,
        visibilityLevel: 'PRIVATE',
      });
      created.push(slug);

      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
      );
      const body = await response.json();

      expect(body.data.map((p: { slug: string }) => p.slug)).not.toContain(slug);
      for (const place of body.data as Array<{ visibilityLevel: string }>) {
        expect(['PUBLIC_EXACT', 'PUBLIC_APPROXIMATE']).toContain(place.visibilityLevel);
      }
    });
  });

  describe('empty results', () => {
    it('returns 200 with an empty array away from the dataset', async () => {
      const response = await nearbyGET(nearbyRequest({ lat: 15, lng: 70, radius: 10000 }));

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.data).toEqual([]);
      expect(body.pagination).toMatchObject({ count: 0, hasMore: false });
      expect(nearbyPlacesResponseSchema.safeParse(body).success).toBe(true);
    });

    it('returns 200 with an empty array when a filter matches nothing', async () => {
      const response = await nearbyGET(
        nearbyRequest({
          ...BENGALURU,
          radius: MAX_RADIUS_METERS,
          category: 'SCENIC_DRIVE',
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.pagination.count).toBe(0);
    });

    it('returns 200 with an empty array past the end of the results', async () => {
      const response = await nearbyGET(
        nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 5, offset: 100000 })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual([]);
      // count still describes the whole result set, not the empty page.
      expect(body.pagination.count).toBeGreaterThan(0);
      expect(body.pagination.hasMore).toBe(false);
    });
  });

  describe('invalid input', () => {
    const invalidCases: Array<{ label: string; query: Record<string, string | number> }> = [
      { label: 'latitude above 90', query: { lat: 91, lng: 77.5946 } },
      { label: 'latitude below -90', query: { lat: -91, lng: 77.5946 } },
      { label: 'longitude above 180', query: { lat: 12.9716, lng: 181 } },
      { label: 'longitude below -180', query: { lat: 12.9716, lng: -181 } },
      { label: 'negative radius', query: { ...BENGALURU, radius: -1000 } },
      { label: 'radius above the 50km cap', query: { ...BENGALURU, radius: 51000 } },
      { label: 'limit above 100', query: { ...BENGALURU, limit: 101 } },
      { label: 'negative offset', query: { ...BENGALURU, offset: -1 } },
      { label: 'non-numeric latitude', query: { lat: 'north', lng: 77.5946 } },
      { label: 'unknown category', query: { ...BENGALURU, category: 'NOT_A_CATEGORY' } },
      { label: 'unknown status', query: { ...BENGALURU, status: 'NOT_A_STATUS' } },
      { label: 'difficulty outside 1-5', query: { ...BENGALURU, difficulty: 9 } },
      { label: 'fractional limit', query: { ...BENGALURU, limit: 2.5 } },
    ];

    it.each(invalidCases)('returns 400 for $label', async ({ query }) => {
      const response = await nearbyGET(nearbyRequest(query));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThan(0);
    });

    it('returns 400 when a required parameter is missing', async () => {
      const response = await nearbyGET(nearbyRequest({ lng: 77.5946 }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });

    it('does not leak SQL or database details in a 400 body', async () => {
      const response = await nearbyGET(nearbyRequest({ ...BENGALURU, radius: 51000 }));
      const raw = await response.text();

      for (const leak of [
        'SELECT',
        'INSERT',
        'UPDATE',
        'FROM "Place"',
        'Prisma',
        'postgres',
        'pgbouncer',
        'stack',
      ]) {
        expect(raw.toLowerCase()).not.toContain(leak.toLowerCase());
      }
    });
  });

  describe('response headers', () => {
    it('sets rate-limit headers on a successful response', async () => {
      const response = await nearbyGET(nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS }));

      expect(response.status).toBe(200);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      expect(headers['x-ratelimit-limit']).toBeDefined();
      expect(headers['x-ratelimit-remaining']).toBeDefined();
      expect(Number(headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('GET /api/places/bounds (real database)', () => {
  const VIEWPORT = { north: 13.2, south: 12.8, east: 77.8, west: 77.2 };

  describe('successful responses', () => {
    it('returns 200 and a contract-valid body for a valid viewport', async () => {
      const response = await boundsGET(boundsRequest({ ...VIEWPORT }));

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(nearbyPlacesResponseSchema.safeParse(body).success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('returns only places inside the viewport', async () => {
      const response = await boundsGET(boundsRequest({ ...VIEWPORT, limit: 100 }));
      const body = await response.json();

      for (const place of body.data as Array<{ latitude: number; longitude: number }>) {
        expect(place.latitude).toBeGreaterThanOrEqual(VIEWPORT.south);
        expect(place.latitude).toBeLessThanOrEqual(VIEWPORT.north);
        expect(place.longitude).toBeGreaterThanOrEqual(VIEWPORT.west);
        expect(place.longitude).toBeLessThanOrEqual(VIEWPORT.east);
      }
    });

    it('orders results by name', async () => {
      const response = await boundsGET(boundsRequest({ ...VIEWPORT, limit: 100 }));
      const body = await response.json();
      const names = body.data.map((p: { name: string }) => p.name);

      expect(names).toEqual([...names].sort());
    });

    it('reports distanceMeters as 0 for viewport results', async () => {
      const response = await boundsGET(boundsRequest({ ...VIEWPORT, limit: 100 }));
      const body = await response.json();

      for (const place of body.data as Array<{ distanceMeters: number }>) {
        expect(place.distanceMeters).toBe(0);
      }
    });

    it('never returns non-public places', async () => {
      const slug = await insertTestPlace({
        name: 'Bounds Restricted Test Place',
        slug: 'test-bounds-api-restricted',
        latitude: 13.0,
        longitude: 77.5,
        visibilityLevel: 'PRIVATE',
      });
      created.push(slug);

      const response = await boundsGET(boundsRequest({ ...VIEWPORT, limit: 100 }));
      const body = await response.json();

      expect(body.data.map((p: { slug: string }) => p.slug)).not.toContain(slug);
    });

    it('paginates without repeating rows', async () => {
      const first = await boundsGET(boundsRequest({ ...VIEWPORT, limit: 2, offset: 0 }));
      const firstBody = await first.json();
      const total = firstBody.pagination.count;

      const walked: string[] = [];
      for (let offset = 0; offset <= total; offset += 2) {
        const page = await boundsGET(boundsRequest({ ...VIEWPORT, limit: 2, offset }));
        const body = await page.json();
        walked.push(...body.data.map((p: { slug: string }) => p.slug));
      }

      expect(new Set(walked).size).toBe(walked.length);
    });
  });

  describe('empty results', () => {
    it('returns 200 with an empty array for an empty region', async () => {
      const response = await boundsGET(boundsRequest({ north: 5, south: 4, east: 80, west: 79 }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.count).toBe(0);
    });
  });

  describe('invalid input', () => {
    const invalidCases: Array<{ label: string; query: Record<string, string | number> }> = [
      {
        label: 'north at or below south',
        query: { north: 12.8, south: 13.2, east: 77.8, west: 77.2 },
      },
      {
        label: 'east at or below west',
        query: { north: 13.2, south: 12.8, east: 77.2, west: 77.8 },
      },
      { label: 'north above 90', query: { north: 91, south: 12.8, east: 77.8, west: 77.2 } },
      { label: 'west below -180', query: { north: 13.2, south: 12.8, east: 77.8, west: -181 } },
      { label: 'limit above 100', query: { ...VIEWPORT, limit: 101 } },
      { label: 'negative offset', query: { ...VIEWPORT, offset: -1 } },
      { label: 'unknown category', query: { ...VIEWPORT, category: 'NOT_A_CATEGORY' } },
      {
        label: 'non-numeric north',
        query: { north: 'north', south: 12.8, east: 77.8, west: 77.2 },
      },
    ];

    it.each(invalidCases)('returns 400 for $label', async ({ query }) => {
      const response = await boundsGET(boundsRequest(query));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.issues.length).toBeGreaterThan(0);
    });

    it('returns 400 when a required viewport edge is missing', async () => {
      const response = await boundsGET(boundsRequest({ north: 13.2, south: 12.8, east: 77.8 }));

      expect(response.status).toBe(400);
    });

    it('does not leak SQL or database details in a 400 body', async () => {
      const response = await boundsGET(
        boundsRequest({ north: 12.8, south: 13.2, east: 77.8, west: 77.2 })
      );
      const raw = await response.text();

      for (const leak of ['SELECT', 'INSERT', 'Prisma', 'postgres', 'stack']) {
        expect(raw.toLowerCase()).not.toContain(leak.toLowerCase());
      }
    });
  });

  describe('response headers', () => {
    it('sets rate-limit headers on a successful response', async () => {
      const response = await boundsGET(boundsRequest({ ...VIEWPORT }));

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      expect(headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});

describe('both endpoints share one contract', () => {
  it('return the same { data, pagination } envelope shape', async () => {
    const nearby = await nearbyGET(nearbyRequest({ ...BENGALURU, radius: 5000 }));
    const bounds = await boundsGET(
      boundsRequest({ north: 13.0, south: 12.9, east: 77.7, west: 77.5 })
    );

    expect(nearby.status).toBe(200);
    expect(bounds.status).toBe(200);

    const nearbyBody = await nearby.json();
    const boundsBody = await bounds.json();

    expect(Object.keys(nearbyBody).sort()).toEqual(Object.keys(boundsBody).sort());
    expect(Object.keys(nearbyBody.pagination).sort()).toEqual(
      Object.keys(boundsBody.pagination).sort()
    );
    expect(isErrorBody(nearbyBody)).toBe(false);
    expect(isErrorBody(boundsBody)).toBe(false);
  });

  it('expose the identical per-place shape', async () => {
    const nearby = await nearbyGET(nearbyRequest({ ...BENGALURU, radius: 5000 }));
    const bounds = await boundsGET(
      boundsRequest({ north: 13.0, south: 12.9, east: 77.7, west: 77.5 })
    );

    const nearbyBody = await nearby.json();
    const boundsBody = await bounds.json();

    if (nearbyBody.data.length > 0 && boundsBody.data.length > 0) {
      expect(Object.keys(nearbyBody.data[0]).sort()).toEqual(
        Object.keys(boundsBody.data[0]).sort()
      );
    }
  });

  it('agree on the set of seeded places inside an overlapping area', async () => {
    // A viewport entirely inside the nearby radius.
    const viewport = { north: 13.1, south: 12.9, east: 77.75, west: 77.45 };

    const nearby = await nearbyGET(
      nearbyRequest({ ...BENGALURU, radius: MAX_RADIUS_METERS, limit: 100 })
    );
    const bounds = await boundsGET(boundsRequest({ ...viewport, limit: 100 }));

    const nearbyBody = await nearby.json();
    const boundsBody = await bounds.json();

    const boundsSlugs = new Set(boundsBody.data.map((p: { slug: string }) => p.slug));
    for (const slug of boundsSlugs) {
      expect(nearbyBody.data.map((p: { slug: string }) => p.slug)).toContain(slug);
    }
  });
});

describe('seeded data is reachable through the API', () => {
  it.each(SEEDED_SLUGS)('%s appears in at least one API response', async (slug) => {
    // Every seeded place must be discoverable: either inside the nearby radius
    // or inside a viewport covering its own coordinates.
    const raw = await prisma.$queryRawUnsafe<{ lat: number; lng: number }[]>(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
         FROM "Place" WHERE slug = $1`,
      slug
    );
    const { lat, lng } = raw[0];

    const asOrigin = await nearbyGET(nearbyRequest({ lat, lng, radius: 1000, limit: 100 }));
    const asOriginBody = await asOrigin.json();

    const asViewport = await boundsGET(
      boundsRequest({
        north: lat + 0.05,
        south: lat - 0.05,
        east: lng + 0.05,
        west: lng - 0.05,
        limit: 100,
      })
    );
    const asViewportBody = await asViewport.json();

    const inNearby = asOriginBody.data.some((p: { slug: string }) => p.slug === slug);
    const inBounds = asViewportBody.data.some((p: { slug: string }) => p.slug === slug);

    expect(inNearby || inBounds).toBe(true);
  });
});
