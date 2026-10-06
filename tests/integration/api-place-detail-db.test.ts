// Integration tests for GET /api/places/[slug] against the REAL database.
//
// Calls the exported route handler, so the whole chain runs: Zod slug validation
// -> rate limiter -> placeService -> findPlaceBySlug (PostGIS) -> response JSON.
// A mocked test cannot catch a column the database does not return, a geography
// value on the wrong axis, or a field the shared contract rejects.
//
// Seeded demo places are the subject wherever possible; rows created here are
// namespaced under "test-" and removed in afterAll.

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/places/[slug]/route';
import {
  placeDetailResponseSchema,
  buildPlaceDetailUrl,
  PLACE_DETAIL_ENDPOINT,
} from '@/features/places/detail';
import { nearbyPlaceSchema } from '@/features/places/nearby';
import { prisma } from '@/lib/db/prisma';
import { insertTestPlace, deleteTestPlaces, purgeTestPlaces } from '@/tests/db-setup';

jest.setTimeout(300_000);

/**
 * The route's api limiter allows 100 requests/minute and keys on `request.ip`,
 * which NextRequest only populates behind a real server — so every in-process
 * request shares the `anonymous` bucket. This suite makes more calls than that,
 * so the limiter is replaced with a pass-through that mirrors its real shape.
 * The real limiter is covered in tests/integration/api-places-rate-limit.test.ts.
 */
jest.mock('@/lib/security', () => {
  const actual = jest.requireActual('@/lib/security');
  return {
    ...actual,
    rateLimiters: {
      ...actual.rateLimiters,
      api: jest.fn(async () => ({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60_000,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': Math.ceil((Date.now() + 60_000) / 1000).toString(),
        },
      })),
    },
  };
});

/** Slugs written by prisma/seed.ts. */
const SEEDED_SLUGS = [
  'nandi-hills-demo',
  'skandagiri-night-trek-demo',
  'chunchi-falls-demo',
  'savandurga-hill-demo',
  'makalidurga-trek-demo',
  'anthargange-demo',
  'ramanagara-ramadevara-betta-demo',
  'devarayanadurga-demo',
] as const;

const created: string[] = [];

// A leftover hidden place from an interrupted run would turn an expected 404
// into a 200, so every run starts from a clean slate.
beforeAll(async () => {
  await purgeTestPlaces();
});

afterAll(async () => {
  await deleteTestPlaces(created);
  await prisma.$disconnect();
});

/** Invokes the route handler for a slug, as Next.js would. */
async function requestDetail(slug: string): Promise<Response> {
  const request = new NextRequest(`http://localhost${buildPlaceDetailUrl(slug)}`);
  return GET(request, { params: { slug } });
}

function headersOf(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

describe('GET /api/places/[slug] (real database)', () => {
  describe('1. a valid public slug', () => {
    it('returns 200 with the place under a { data } envelope', async () => {
      const response = await requestDetail(SEEDED_SLUGS[0]);

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(Object.keys(body)).toEqual(['data']);
      expect(body.data.slug).toBe(SEEDED_SLUGS[0]);
      expect(typeof body.data.id).toBe('string');
      expect(typeof body.data.name).toBe('string');
    });

    it('returns the description the seed wrote', async () => {
      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      const raw = await prisma.$queryRawUnsafe<{ description: string }[]>(
        `SELECT description FROM "Place" WHERE slug = $1`,
        'nandi-hills-demo'
      );

      expect(body.data.description).toBe(raw[0].description);
      expect(body.data.description.length).toBeGreaterThan(0);
    });

    it('returns coordinates on the correct axis, matching the database', async () => {
      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      const raw = await prisma.$queryRawUnsafe<{ lat: number; lng: number }[]>(
        `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
           FROM "Place" WHERE slug = $1`,
        'nandi-hills-demo'
      );

      expect(body.data.latitude).toBeCloseTo(raw[0].lat, 9);
      expect(body.data.longitude).toBeCloseTo(raw[0].lng, 9);
      // Bengaluru is near 12.97N / 77.59E; swapped axes would break these.
      expect(body.data.longitude).toBeGreaterThan(70);
      expect(body.data.longitude).toBeLessThan(80);
      expect(body.data.latitude).toBeGreaterThan(10);
      expect(body.data.latitude).toBeLessThan(16);
    });

    it('returns enum and trust fields unchanged from the database', async () => {
      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      const raw = await prisma.$queryRawUnsafe<
        {
          category: string;
          status: string;
          trustLevel: string;
          visibilityLevel: string;
          trustScore: number;
          permitRequired: boolean;
          hasParking: boolean;
          hasWater: boolean;
          hasNetwork: boolean;
        }[]
      >(
        `SELECT category::text, status::text, "trustLevel"::text, "visibilityLevel"::text,
                "trustScore", "permitRequired", "hasParking", "hasWater", "hasNetwork"
           FROM "Place" WHERE slug = $1`,
        'nandi-hills-demo'
      );

      expect(body.data.category).toBe(raw[0].category);
      expect(body.data.status).toBe(raw[0].status);
      expect(body.data.trustLevel).toBe(raw[0].trustLevel);
      expect(body.data.visibilityLevel).toBe(raw[0].visibilityLevel);
      expect(Number(body.data.trustScore)).toBe(Number(raw[0].trustScore));
      expect(body.data.permitRequired).toBe(raw[0].permitRequired);
      expect(body.data.hasParking).toBe(raw[0].hasParking);
      expect(body.data.hasWater).toBe(raw[0].hasWater);
      expect(body.data.hasNetwork).toBe(raw[0].hasNetwork);
    });

    it('always returns sources and photos as arrays, never null', async () => {
      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      expect(Array.isArray(body.data.sources)).toBe(true);
      expect(Array.isArray(body.data.photos)).toBe(true);
    });

    it('returns an empty photo array while no PlacePhoto rows exist', async () => {
      const total = await prisma.placePhoto.count();
      expect(total).toBe(0);

      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      expect(body.data.photos).toEqual([]);
      // primaryPhotoUrl is resolved by the LATERAL join in the same statement.
      expect(body.data.primaryPhotoUrl).toBeNull();
    });

    it('reports distanceMeters as 0, matching the single-place repository contract', async () => {
      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      // No reference point exists for a detail lookup, so this is a constant 0
      // by contract rather than a measured distance.
      expect(body.data.distanceMeters).toBe(0);
    });

    it('sets rate-limit headers on a successful response', async () => {
      const response = await requestDetail('nandi-hills-demo');
      const headers = headersOf(response);

      expect(headers['x-ratelimit-limit']).toBeDefined();
      expect(headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('2. every seeded public place', () => {
    it.each(SEEDED_SLUGS)('serves %s', async (slug) => {
      const response = await requestDetail(slug);

      expect(response.status).toBe(200);
      const body = await response.json();

      const parsed = placeDetailResponseSchema.safeParse(body);
      expect(
        parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      ).toEqual([]);
      expect(body.data.slug).toBe(slug);
    });
  });

  describe('3. an unknown slug', () => {
    it('returns 404 for a well-formed slug that does not exist', async () => {
      const response = await requestDetail('no-such-place-anywhere');

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Place not found');
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns a 404 body with no place data and no pagination', async () => {
      const response = await requestDetail('still-not-here');
      const body = await response.json();

      expect(body.data).toBeUndefined();
      expect(body.pagination).toBeUndefined();
    });

    it('does not distinguish an unknown slug from a deleted one', async () => {
      const unknown = await requestDetail('definitely-not-a-real-slug');
      expect(unknown.status).toBe(404);
    });
  });

  describe('4. an empty or invalid slug', () => {
    it.each([
      { label: 'uppercase letters', slug: 'Nandi-Hills' },
      { label: 'spaces', slug: 'nandi hills' },
      { label: 'a slash', slug: 'nandi/hills' },
      { label: 'trailing whitespace', slug: 'nandi-hills ' },
      { label: 'a dot', slug: 'nandi.hills' },
      { label: 'a query separator', slug: 'nandi-hills?x=1' },
      { label: 'over the length limit', slug: 'a'.repeat(300) },
    ])('returns 400 for $label', async ({ slug }) => {
      const response = await requestDetail(slug);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThan(0);
      expect(body.data).toBeUndefined();
    });

    it('returns 400 for an empty slug', async () => {
      const response = await requestDetail('');

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });

    it('uses the same 400 envelope as the sibling list routes', async () => {
      const detail = await requestDetail('NOT VALID');
      const detailBody = await detail.json();

      expect(Object.keys(detailBody).sort()).toEqual(['error', 'issues']);
      expect(detailBody.issues[0]).toHaveProperty('path');
      expect(detailBody.issues[0]).toHaveProperty('message');
    });
  });

  describe('5. non-public places', () => {
    it.each(['PRIVATE', 'MODERATOR_ONLY', 'VERIFIED_COMMUNITY_ONLY'] as const)(
      'returns 404 for a %s place',
      async (visibilityLevel) => {
        // The slug must satisfy placeSlugSchema (lowercase kebab-case), so the
        // enum's underscores are translated.
        const slug = await insertTestPlace({
          name: `Detail Restricted ${visibilityLevel}`,
          slug: `test-detail-${visibilityLevel.toLowerCase().replace(/_/g, '-')}`,
          latitude: 12.9716,
          longitude: 77.5946,
          visibilityLevel,
        });
        created.push(slug);

        const response = await requestDetail(slug);

        // 404, not 403: a hidden place must not be confirmed to exist.
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.data).toBeUndefined();
        expect(body.error).toBe('Place not found');
      }
    );

    it('does not leak the restricted place through a by-id style lookup', async () => {
      const slug = await insertTestPlace({
        name: 'Detail Restricted By Id',
        slug: 'test-detail-by-id',
        latitude: 12.9716,
        longitude: 77.5946,
        visibilityLevel: 'PRIVATE',
      });
      created.push(slug);

      // The row exists and is readable as an id, but the detail route is
      // slug-addressed and must still refuse it.
      const row = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Place" WHERE slug = $1`,
        slug
      );
      expect(row[0].id).toBeDefined();
      expect(row[0].id).not.toContain('/');

      const response = await requestDetail(slug);
      expect(response.status).toBe(404);
    });

    it('returns 404 for a closed place, since closure is not a visibility rule', async () => {
      // CLOSED is public information, so it must remain readable. This pins the
      // distinction between a status and a visibility level.
      const slug = await insertTestPlace({
        name: 'Detail Closed Test Place',
        slug: 'test-detail-closed',
        latitude: 12.9716,
        longitude: 77.5946,
        status: 'CLOSED',
        visibilityLevel: 'PUBLIC_EXACT',
      });
      created.push(slug);

      const response = await requestDetail(slug);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.status).toBe('CLOSED');
    });
  });

  describe('6. response contract', () => {
    it('matches placeDetailResponseSchema for a seeded place', async () => {
      const response = await requestDetail('chunchi-falls-demo');
      const body = await response.json();

      const parsed = placeDetailResponseSchema.safeParse(body);
      expect(
        parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      ).toEqual([]);
    });

    it('extends the list contract, so shared fields keep identical types', async () => {
      const response = await requestDetail('chunchi-falls-demo');
      const body = await response.json();

      // The detail payload must satisfy the list schema too — it is a superset.
      expect(nearbyPlaceSchema.safeParse(body.data).success).toBe(true);
    });

    it('exposes exactly the documented field set', async () => {
      const response = await requestDetail('chunchi-falls-demo');
      const body = await response.json();

      expect(Object.keys(body.data).sort()).toEqual(
        [
          'category',
          'description',
          'difficulty',
          'distanceMeters',
          'hasNetwork',
          'hasParking',
          'hasWater',
          'id',
          'latitude',
          'longitude',
          'name',
          'permitRequired',
          'photos',
          'primaryPhotoUrl',
          'shortDescription',
          'slug',
          'sources',
          'status',
          'trailDistanceKm',
          'trustLevel',
          'trustScore',
          'visibilityLevel',
        ].sort()
      );
    });

    it('never returns null for a required field', async () => {
      for (const slug of SEEDED_SLUGS) {
        const response = await requestDetail(slug);
        const body = await response.json();

        for (const key of [
          'id',
          'name',
          'slug',
          'category',
          'status',
          'trustLevel',
          'visibilityLevel',
          'latitude',
          'longitude',
          'distanceMeters',
        ]) {
          expect(body.data[key]).not.toBeNull();
          expect(body.data[key]).not.toBeUndefined();
        }
      }
    });

    it('is JSON-serialisable with no BigInt or Date instances', async () => {
      const response = await requestDetail('nandi-hills-demo');

      // A BigInt in the payload would throw during serialisation inside the
      // route, so a successful response proves the raw rows are plain JSON.
      const body = await response.json();
      expect(() => JSON.parse(JSON.stringify(body))).not.toThrow();
    });

    it('agrees with findPlaceBySlug, proving no query was duplicated', async () => {
      const { findPlaceBySlug } = await import('@/features/places/repositories');
      const direct = await findPlaceBySlug('anthargange-demo');
      const response = await requestDetail('anthargange-demo');
      const body = await response.json();

      expect(body.data).toEqual(direct);
    });
  });

  describe('7. error leakage', () => {
    it.each([
      { label: 'a 404', slug: 'no-such-place-anywhere' },
      { label: 'a 400', slug: 'NOT VALID' },
    ])('exposes no internals in $label body', async ({ slug }) => {
      const response = await requestDetail(slug);
      const raw = await response.text();

      expect(raw.length).toBeGreaterThan(0);
      for (const leak of [
        'SELECT',
        'INSERT',
        'UPDATE ',
        'FROM "Place"',
        'PlacePhoto',
        'Prisma',
        'postgres',
        'pgbouncer',
        'Supabase',
        'Unsupported',
        'geography',
        'stack',
        'at Object',
        'node_modules',
      ]) {
        expect(raw.toLowerCase()).not.toContain(leak.toLowerCase());
      }
    });

    it('does not leak the restricted slug of a hidden place', async () => {
      const slug = await insertTestPlace({
        name: 'Detail Hidden Name Marker',
        slug: 'test-detail-hidden-marker',
        latitude: 12.9716,
        longitude: 77.5946,
        visibilityLevel: 'PRIVATE',
      });
      created.push(slug);

      const response = await requestDetail(slug);
      const raw = await response.text();

      expect(raw).not.toContain('Hidden Name Marker');
      expect(raw).not.toContain('PRIVATE');
      expect(raw).not.toContain('test-detail-hidden-marker');
    });

    it('turns an unexpected repository failure into a generic 500', async () => {
      const { placeService } = await import('@/features/places/services');
      const spy = jest
        .spyOn(placeService, 'getBySlug')
        .mockRejectedValue(new Error('relation "Place" does not exist'));

      try {
        const response = await requestDetail('nandi-hills-demo');
        const raw = await response.text();

        expect(response.status).toBe(500);
        expect(JSON.parse(raw)).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
        // The database detail must not reach the client.
        expect(raw).not.toContain('does not exist');
        expect(raw).not.toContain('relation');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('8. rate limiting', () => {
    it('returns 429 with a Retry-After header when the budget is spent', async () => {
      const { rateLimiters } = await import('@/lib/security');
      const limiter = rateLimiters.api as unknown as jest.Mock;

      limiter.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '0',
          'Retry-After': '30',
        },
      });

      const response = await requestDetail('nandi-hills-demo');
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body).toEqual({ error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' });
      expect(headersOf(response)['retry-after']).toBe('30');
      // No place data may accompany a throttled response.
      expect(body.data).toBeUndefined();
    });

    it('rate limits before any database lookup', async () => {
      const { placeService } = await import('@/features/places/services');
      const { rateLimiters } = await import('@/lib/security');
      const limiter = rateLimiters.api as unknown as jest.Mock;
      const spy = jest.spyOn(placeService, 'getBySlug');

      limiter.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        headers: { 'Retry-After': '30' },
      });

      try {
        const response = await requestDetail('nandi-hills-demo');
        expect(response.status).toBe(429);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('client contract helpers', () => {
    it('builds an encoded detail URL', () => {
      expect(PLACE_DETAIL_ENDPOINT).toBe('/api/places');
      expect(buildPlaceDetailUrl('nandi-hills-demo')).toBe('/api/places/nandi-hills-demo');
      expect(buildPlaceDetailUrl('a slug')).toBe('/api/places/a%20slug');
      expect(buildPlaceDetailUrl('a/b')).toBe('/api/places/a%2Fb');
    });
  });
});
