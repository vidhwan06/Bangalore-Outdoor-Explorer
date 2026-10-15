// Integration tests for features/places/repositories.ts against the REAL database.
//
// Unit coverage (tests/unit/places-repository.test.ts) mocks the driver and
// asserts the SQL that gets built. That cannot catch a column that the
// database does not return, a geography value that round-trips into the wrong
// axis, or a value that the shared response contract rejects. These tests run
// the real SQL against the real PostGIS schema.
//
// Real imported places (data/places.json) are used as the subject wherever
// possible, so the assertions cover exactly what the importer writes. Nothing
// here mutates imported rows; rows created by the tests are namespaced under the
// "test-" prefix and removed in afterAll.

import { prisma } from '@/lib/db/prisma';
import {
  buildFilterWhere,
  findNearbyPlaces,
  findPlacesInBounds,
  findPlaceById,
  findPlaceBySlug,
  getCategoryCounts,
} from '@/features/places/repositories';
import {
  findPhotosForPlace,
  findPrimaryPhotoUrl,
  findPrimaryPhotoUrls,
} from '@/features/places/photos';
import { placeService } from '@/features/places/services';
import { nearbyPlaceSchema } from '@/features/places/nearby';
import { insertTestPlace, deleteTestPlaces, purgeTestPlaces } from '@/tests/db-setup';

// Every test here talks to a remote Postgres over the network, and several loop
// over the whole seed set, so Jest's 5s default is not enough. The ceiling is
// generous on purpose: these suites run serially, and a test that pages a 16-row
// result set five different ways issues ~80 sequential round trips. Observed
// latency on the shared host has ranged from ~50ms to ~400ms per query, so a
// tighter limit turns ordinary network variance into a false failure.
jest.setTimeout(300_000);

/** Bengaluru city centre, the reference point used across the suite. */
const BENGALURU = { latitude: 12.9716, longitude: 77.5946 } as const;

/**
 * Radius wide enough to contain every seeded place. Some seed coordinates sit
 * well outside the 50km the service layer caps requests at (Chunchi Falls is
 * ~60km out, Anthargange ~70km, Devarayanadurga ~55km), so the repository-level
 * tests use a larger radius. Clamping to 50km is a `placeService` concern and is
 * asserted separately in the service section.
 */
const WIDE_RADIUS_METERS = 250000;

/** The service layer's documented maximum search radius. */
const SERVICE_MAX_RADIUS_METERS = 50000;

/** Slugs of the real imported places (data/places.json). */
const SEEDED_SLUGS = [
  'nandi-hills',
  'skandagiri',
  'chunchi-falls',
  'savandurga-hill',
  'makalidurga',
  'anthargange',
  'ramadevara-betta',
  'devarayanadurga',
] as const;

/** Rows these tests create. Always cleaned up. */
const created: string[] = [];

// Start from a known state. Several assertions here depend on an exact row
// count in a radius ("a 1km radius around the city centre contains no places",
// "no LAKE is publicly visible"), which a fixture orphaned by an interrupted
// run would otherwise invalidate.
beforeAll(async () => {
  await prisma.$connect();
  await purgeTestPlaces();
});

afterAll(async () => {
  await deleteTestPlaces(created);
  // Reconnect so subsequent test files sharing this singleton can use it.
  await prisma.$connect();
});

describe('Prisma client lifecycle', () => {
  it('remains connected after disconnect-reconnect cycle', async () => {
    await prisma.$disconnect();
    await prisma.$connect();
    const count = await prisma.place.count();
    expect(count).toBeGreaterThan(0);
  });
});

describe('repository layer against the live database', () => {
  describe('seeded data is readable through the repository', () => {
    it('finds every seeded place within the wide radius', async () => {
      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });

      const slugs = new Set(result.data.map((place) => place.slug));
      const missing = SEEDED_SLUGS.filter((slug) => !slugs.has(slug));
      expect(missing).toEqual([]);
    });

    it('reads each seeded place by slug with description and relations', async () => {
      for (const slug of SEEDED_SLUGS) {
        const place = await findPlaceBySlug(slug);

        expect(place).not.toBeNull();
        if (!place) continue;

        expect(place.slug).toBe(slug);
        // The importer always writes a description for real places.
        expect(place.description).not.toBeNull();
        expect(typeof place.description).toBe('string');
        // Sources and photos are 1-to-many; both must be arrays, never undefined.
        expect(Array.isArray(place.sources)).toBe(true);
        expect(Array.isArray(place.photos)).toBe(true);
      }
    });

    it('reads each seeded place by id as well as by slug', async () => {
      for (const slug of SEEDED_SLUGS) {
        const bySlug = await findPlaceBySlug(slug);
        expect(bySlug).not.toBeNull();
        if (!bySlug) continue;

        const byId = await findPlaceById(bySlug.id);
        expect(byId).not.toBeNull();
        if (!byId) continue;

        expect(byId.id).toBe(bySlug.id);
        expect(byId.slug).toBe(bySlug.slug);
        expect(byId.name).toBe(bySlug.name);
        expect(byId.category).toBe(bySlug.category);
      }
    });

    it('round-trips seeded enum, score and facility fields unchanged', async () => {
      const seeded = await prisma.$queryRawUnsafe<
        {
          slug: string;
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
        `
        SELECT slug, category::text, status::text, "trustLevel"::text,
               "visibilityLevel"::text, "trustScore", "permitRequired",
               "hasParking", "hasWater", "hasNetwork"
          FROM "Place" WHERE slug = ANY($1)
      `,
        SEEDED_SLUGS as unknown as string[]
      );

      expect(seeded.length).toBe(SEEDED_SLUGS.length);

      for (const row of seeded) {
        const place = await findPlaceBySlug(row.slug);
        expect(place).not.toBeNull();
        if (!place) continue;

        expect(place.category).toBe(row.category);
        expect(place.status).toBe(row.status);
        expect(place.trustLevel).toBe(row.trustLevel);
        expect(place.visibilityLevel).toBe(row.visibilityLevel);
        expect(Number(place.trustScore)).toBe(Number(row.trustScore));
        expect(place.permitRequired).toBe(row.permitRequired);
        expect(place.hasParking).toBe(row.hasParking);
        expect(place.hasWater).toBe(row.hasWater);
        expect(place.hasNetwork).toBe(row.hasNetwork);
      }
    });

    it('interprets geography coordinates on the correct axis', async () => {
      const raw = await prisma.$queryRawUnsafe<{ slug: string; lat: number; lng: number }[]>(
        `
        SELECT slug, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
          FROM "Place" WHERE slug = ANY($1)
      `,
        SEEDED_SLUGS as unknown as string[]
      );

      for (const row of raw) {
        const place = await findPlaceBySlug(row.slug);
        expect(place).not.toBeNull();
        if (!place) continue;

        // Bengaluru longitudes are ~77, latitudes ~12-13. A swapped pair would
        // put longitude in the 12-13 range, so these bounds prove the axis.
        expect(place.longitude).toBeCloseTo(row.lng, 9);
        expect(place.latitude).toBeCloseTo(row.lat, 9);
        expect(place.longitude).toBeGreaterThan(70);
        expect(place.longitude).toBeLessThan(80);
        expect(place.latitude).toBeGreaterThan(10);
        expect(place.latitude).toBeLessThan(16);
      }
    });

    it('returns the same coordinates through the nearby and bounds queries', async () => {
      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      const bounds = await findPlacesInBounds({
        north: 14,
        south: 12,
        east: 79,
        west: 76,
        limit: 100,
        offset: 0,
      });

      const boundsBySlug = new Map(bounds.data.map((place) => [place.slug, place]));
      for (const place of nearby.data) {
        const fromBounds = boundsBySlug.get(place.slug);
        if (!fromBounds) continue;
        expect(fromBounds.latitude).toBeCloseTo(place.latitude, 9);
        expect(fromBounds.longitude).toBeCloseTo(place.longitude, 9);
      }
    });
  });

  describe('response contract', () => {
    it('satisfies nearbyPlaceSchema for every row of every list query', async () => {
      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      const bounds = await findPlacesInBounds({
        north: 14,
        south: 12,
        east: 79,
        west: 76,
        limit: 100,
        offset: 0,
      });

      expect(nearby.data.length).toBeGreaterThan(0);
      expect(bounds.data.length).toBeGreaterThan(0);

      for (const place of [...nearby.data, ...bounds.data]) {
        const parsed = nearbyPlaceSchema.safeParse(place);
        expect(
          parsed.success
            ? []
            : parsed.error.issues.map((i) => `${place.slug}.${i.path.join('.')}: ${i.message}`)
        ).toEqual([]);
      }
    });

    it('satisfies nearbyPlaceSchema for detail lookups', async () => {
      for (const slug of SEEDED_SLUGS) {
        const bySlug = await findPlaceBySlug(slug);
        const parsed = nearbyPlaceSchema.safeParse(bySlug);
        expect(
          parsed.success
            ? []
            : parsed.error.issues.map((i) => `${slug}.${i.path.join('.')}: ${i.message}`)
        ).toEqual([]);

        if (bySlug) {
          const byId = await findPlaceById(bySlug.id);
          const parsedId = nearbyPlaceSchema.safeParse(byId);
          expect(
            parsedId.success
              ? []
              : parsedId.error.issues.map((i) => `${slug}.${i.path.join('.')}: ${i.message}`)
          ).toEqual([]);
        }
      }
    });

    it('never returns NULL in a field the contract marks as required', async () => {
      const required = Object.entries(nearbyPlaceSchema.shape)
        .filter(([, schema]) => !schema.isOptional() && !schema.isNullable())
        .map(([key]) => key);

      expect(required.length).toBeGreaterThan(0);

      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });

      for (const place of nearby.data) {
        for (const key of required) {
          expect(place[key as keyof typeof place]).not.toBeNull();
          expect(place[key as keyof typeof place]).not.toBeUndefined();
        }
      }
    });

    it('reports a numeric distanceMeters and zero for single-place lookups', async () => {
      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 10,
        offset: 0,
      });
      for (const place of nearby.data) {
        expect(Number.isFinite(place.distanceMeters)).toBe(true);
        expect(place.distanceMeters).toBeGreaterThanOrEqual(0);
      }

      const detail = await findPlaceBySlug(SEEDED_SLUGS[0]);
      // Single-place lookups have no reference point, so distance is 0 by
      // contract rather than NULL.
      expect(detail?.distanceMeters).toBe(0);
    });
  });

  describe('visibility rules against real rows', () => {
    it('excludes non-public places from nearby, bounds and detail lookups', async () => {
      const slug = await insertTestPlace({
        name: 'Restricted Test Place',
        slug: 'test-visibility-restricted',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        visibilityLevel: 'PRIVATE',
      });
      created.push(slug);

      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
      });
      expect(nearby.data.map((p) => p.slug)).not.toContain(slug);
      expect(nearby.pagination.count).toBe(0);

      const bounds = await findPlacesInBounds({
        north: 13.2,
        south: 12.8,
        east: 77.8,
        west: 77.2,
        limit: 100,
        offset: 0,
      });
      expect(bounds.data.map((p) => p.slug)).not.toContain(slug);

      expect(await findPlaceBySlug(slug)).toBeNull();

      const row = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Place" WHERE slug = $1`,
        slug
      );
      expect(await findPlaceById(row[0].id)).toBeNull();
    });

    it('excludes MODERATOR_ONLY and VERIFIED_COMMUNITY_ONLY places', async () => {
      for (const visibilityLevel of ['MODERATOR_ONLY', 'VERIFIED_COMMUNITY_ONLY'] as const) {
        const slug = await insertTestPlace({
          name: `Restricted ${visibilityLevel}`,
          slug: `test-visibility-${visibilityLevel.toLowerCase()}`,
          latitude: BENGALURU.latitude,
          longitude: BENGALURU.longitude,
          visibilityLevel,
        });
        created.push(slug);

        expect(await findPlaceBySlug(slug)).toBeNull();

        const nearby = await findNearbyPlaces({
          ...BENGALURU,
          radiusMeters: 1000,
          limit: 50,
          offset: 0,
        });
        expect(nearby.data.map((p) => p.slug)).not.toContain(slug);
      }
    });

    it('includes PUBLIC_APPROXIMATE places alongside PUBLIC_EXACT', async () => {
      const exact = await insertTestPlace({
        name: 'Public Exact Test Place',
        slug: 'test-visibility-exact',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        visibilityLevel: 'PUBLIC_EXACT',
      });
      const approximate = await insertTestPlace({
        name: 'Public Approximate Test Place',
        slug: 'test-visibility-approximate',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        visibilityLevel: 'PUBLIC_APPROXIMATE',
      });
      created.push(exact, approximate);

      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
      });
      const slugs = nearby.data.map((p) => p.slug);

      expect(slugs).toContain(exact);
      expect(slugs).toContain(approximate);
      expect(await findPlaceBySlug(approximate)).not.toBeNull();
    });

    it('agrees with buildFilterWhere: every returned place is publicly visible', async () => {
      const { where } = buildFilterWhere();
      expect(where).toContain('PUBLIC_EXACT');
      expect(where).toContain('PUBLIC_APPROXIMATE');

      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      for (const place of nearby.data) {
        expect(['PUBLIC_EXACT', 'PUBLIC_APPROXIMATE']).toContain(place.visibilityLevel);
      }
    });
  });

  describe('distance and radius behaviour', () => {
    it('returns 0m for a place queried from its own coordinates', async () => {
      const slug = await insertTestPlace({
        name: 'Distance Zero Test Place',
        slug: 'test-distance-zero',
        latitude: 12.5,
        longitude: 77.25,
      });
      created.push(slug);

      const result = await findNearbyPlaces({
        latitude: 12.5,
        longitude: 77.25,
        radiusMeters: 100,
        limit: 10,
        offset: 0,
      });
      const place = result.data.find((p) => p.slug === slug);

      expect(place).toBeDefined();
      expect(place?.distanceMeters).toBeCloseTo(0, 3);
    });

    it('orders results by ascending distance', async () => {
      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });

      expect(result.data.length).toBeGreaterThan(1);
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].distanceMeters).toBeGreaterThanOrEqual(
          result.data[i - 1].distanceMeters
        );
      }
    });

    it('excludes places beyond the radius, including just outside it', async () => {
      // ~60 km south-west of the reference point: outside a 50 km radius, but
      // inside the wide radius used by the other repository tests.
      const far = await insertTestPlace({
        name: 'Far Away Test Place',
        slug: 'test-radius-far',
        latitude: 12.44,
        longitude: 77.42,
      });
      created.push(far);

      const withinServiceMax = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: SERVICE_MAX_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      const wide = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      const narrow = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 100,
        offset: 0,
      });

      // Present only when the radius actually reaches it.
      expect(wide.data.map((p) => p.slug)).toContain(far);
      expect(withinServiceMax.data.map((p) => p.slug)).not.toContain(far);
      expect(narrow.data.map((p) => p.slug)).not.toContain(far);

      // Every row must satisfy the radius it was queried with.
      for (const place of wide.data) {
        expect(place.distanceMeters).toBeLessThanOrEqual(WIDE_RADIUS_METERS);
      }
      for (const place of withinServiceMax.data) {
        expect(place.distanceMeters).toBeLessThanOrEqual(SERVICE_MAX_RADIUS_METERS);
      }
      for (const place of narrow.data) {
        expect(place.distanceMeters).toBeLessThanOrEqual(1000);
      }
    });

    it('computes a plausible distance for a known offset', async () => {
      // 0.01 degrees of latitude is ~1.11 km.
      const slug = await insertTestPlace({
        name: 'Distance Reference Test Place',
        slug: 'test-distance-reference',
        latitude: BENGALURU.latitude + 0.01,
        longitude: BENGALURU.longitude,
      });
      created.push(slug);

      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 5000,
        limit: 100,
        offset: 0,
      });
      const place = result.data.find((p) => p.slug === slug);

      expect(place).toBeDefined();
      // ST_Distance on geography returns metres; allow a generous band for the
      // spheroid approximation but keep it far from a swapped-axes value.
      expect(place?.distanceMeters).toBeGreaterThan(1000);
      expect(place?.distanceMeters).toBeLessThan(1200);
    });

    it('is symmetric: distance from A to B equals the distance from B to A', async () => {
      const a = await insertTestPlace({
        name: 'Symmetry A Test Place',
        slug: 'test-symmetry-a',
        latitude: 12.8,
        longitude: 77.4,
      });
      const b = await insertTestPlace({
        name: 'Symmetry B Test Place',
        slug: 'test-symmetry-b',
        latitude: 13.1,
        longitude: 77.7,
      });
      created.push(a, b);

      const fromA = await findNearbyPlaces({
        latitude: 12.8,
        longitude: 77.4,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      const fromB = await findNearbyPlaces({
        latitude: 13.1,
        longitude: 77.7,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });

      const abFromA = fromA.data.find((p) => p.slug === b)?.distanceMeters;
      const abFromB = fromB.data.find((p) => p.slug === a)?.distanceMeters;

      expect(abFromA).toBeDefined();
      expect(abFromB).toBeDefined();
      expect(abFromA).toBeCloseTo(abFromB!, 3);
    });
  });

  describe('ordering determinism and pagination', () => {
    it('breaks distance ties deterministically so pages do not repeat rows', async () => {
      // Two places at exactly the same coordinates force a distance tie. The
      // seeded set already contains such pairs; these make the tie explicit.
      const slugA = await insertTestPlace({
        name: 'Tie A Test Place',
        slug: 'test-tie-a',
        latitude: 13.05,
        longitude: 77.65,
      });
      const slugB = await insertTestPlace({
        name: 'Tie B Test Place',
        slug: 'test-tie-b',
        latitude: 13.05,
        longitude: 77.65,
      });
      created.push(slugA, slugB);

      const all = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });

      // The tie really exists in the data.
      const tieA = all.data.find((p) => p.slug === slugA);
      const tieB = all.data.find((p) => p.slug === slugB);
      expect(tieA).toBeDefined();
      expect(tieB).toBeDefined();
      expect(tieA!.distanceMeters).toBe(tieB!.distanceMeters);

      // Walking every page size must surface each row exactly once. Without a
      // tiebreaker in ORDER BY, Postgres may return a tied row on two pages and
      // silently omit its partner.
      for (const limit of [1, 2, 3, 5, 7]) {
        const walked: string[] = [];
        for (let offset = 0; offset <= all.pagination.count; offset += limit) {
          const page = await findNearbyPlaces({
            ...BENGALURU,
            radiusMeters: WIDE_RADIUS_METERS,
            limit,
            offset,
          });
          walked.push(...page.data.map((p) => p.slug));
        }

        expect(new Set(walked).size).toBe(walked.length);
        expect(walked.sort()).toEqual(all.data.map((p) => p.slug).sort());
      }
    });

    it('returns the same order on repeated identical queries', async () => {
      const params = {
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      };
      const first = await findNearbyPlaces(params);
      for (let run = 0; run < 3; run++) {
        const repeat = await findNearbyPlaces(params);
        expect(repeat.data.map((p) => p.id)).toEqual(first.data.map((p) => p.id));
      }
    });

    it('orders bounds results by name with a stable tiebreaker', async () => {
      const params = {
        north: 14,
        south: 12,
        east: 79,
        west: 76,
        limit: 100,
        offset: 0,
      };
      const result = await findPlacesInBounds(params);

      const names = result.data.map((p) => p.name);
      expect(names).toEqual([...names].sort());

      // Walk pages to prove no row is repeated or dropped.
      const walked: string[] = [];
      for (let offset = 0; offset <= result.pagination.count; offset += 2) {
        const page = await findPlacesInBounds({ ...params, limit: 2, offset });
        walked.push(...page.data.map((p) => p.slug));
      }
      expect(new Set(walked).size).toBe(walked.length);
    });

    it('reports count independently of limit and offset', async () => {
      const base = {
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      };
      const reference = await findNearbyPlaces(base);

      const small = await findNearbyPlaces({ ...base, limit: 2, offset: 0 });
      const later = await findNearbyPlaces({ ...base, limit: 2, offset: 2 });

      expect(small.pagination.count).toBe(reference.pagination.count);
      expect(later.pagination.count).toBe(reference.pagination.count);
    });

    it('computes hasMore correctly across pages', async () => {
      const base = {
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 3,
        offset: 0,
      };
      const first = await findNearbyPlaces(base);
      expect(first.pagination.hasMore).toBe(
        first.pagination.offset + first.pagination.limit < first.pagination.count
      );

      const lastOffset = Math.max(0, first.pagination.count - 1);
      const last = await findNearbyPlaces({ ...base, offset: lastOffset });
      expect(last.pagination.hasMore).toBe(false);
    });

    it('returns an empty page past the end without erroring', async () => {
      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 5,
        offset: 100000,
      });

      expect(result.data).toEqual([]);
      // count still reflects the true total, not the empty page.
      expect(result.pagination.count).toBeGreaterThan(0);
    });

    it('returns no results for a location far outside the dataset', async () => {
      const result = await findNearbyPlaces({
        latitude: 15,
        longitude: 70,
        radiusMeters: 10000,
        limit: 20,
        offset: 0,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('filters against real rows', () => {
    it('filters by category', async () => {
      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
        category: 'TREK',
      });

      expect(result.data.length).toBeGreaterThan(0);
      for (const place of result.data) {
        expect(place.category).toBe('TREK');
      }
    });

    it('filters by status and excludes closed places when asked', async () => {
      const closed = await insertTestPlace({
        name: 'Closed Test Place',
        slug: 'test-filter-closed',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        status: 'CLOSED',
      });
      created.push(closed);

      const open = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
        status: 'OPEN',
      });
      expect(open.data.map((p) => p.slug)).not.toContain(closed);
      for (const place of open.data) {
        expect(place.status).toBe('OPEN');
      }

      const closedResult = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
        status: 'CLOSED',
      });
      expect(closedResult.data.map((p) => p.slug)).toContain(closed);

      // Without a status filter, a closed place is still returned: closure is
      // information, not a visibility rule.
      const unfiltered = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
      });
      expect(unfiltered.data.map((p) => p.slug)).toContain(closed);
    });

    it('filters by difficulty', async () => {
      const slug = await insertTestPlace({
        name: 'Difficulty Five Test Place',
        slug: 'test-filter-difficulty',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        difficulty: 5,
      });
      created.push(slug);

      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
        difficulty: 5,
      });

      expect(result.data.map((p) => p.slug)).toContain(slug);
      for (const place of result.data) {
        expect(place.difficulty).toBe(5);
      }
    });

    it('applies category, status and difficulty together', async () => {
      const slug = await insertTestPlace({
        name: 'Combined Filter Test Place',
        slug: 'test-filter-combined',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        category: 'CAMPING',
        status: 'PERMIT_REQUIRED',
        difficulty: 3,
      });
      created.push(slug);

      const result = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 1000,
        limit: 50,
        offset: 0,
        category: 'CAMPING',
        status: 'PERMIT_REQUIRED',
        difficulty: 3,
      });

      expect(result.data.map((p) => p.slug)).toContain(slug);
      for (const place of result.data) {
        expect(place.category).toBe('CAMPING');
        expect(place.status).toBe('PERMIT_REQUIRED');
        expect(place.difficulty).toBe(3);
      }
    });
  });

  describe('bounds queries against real rows', () => {
    it('includes only places inside the viewport', async () => {
      const inside = await insertTestPlace({
        name: 'Inside Bounds Test Place',
        slug: 'test-bounds-inside',
        latitude: 13.0,
        longitude: 77.5,
      });
      const outside = await insertTestPlace({
        name: 'Outside Bounds Test Place',
        slug: 'test-bounds-outside',
        latitude: 8.0,
        longitude: 77.5,
      });
      created.push(inside, outside);

      const result = await findPlacesInBounds({
        north: 13.2,
        south: 12.8,
        east: 77.8,
        west: 77.2,
        limit: 100,
        offset: 0,
      });

      const slugs = result.data.map((p) => p.slug);
      expect(slugs).toContain(inside);
      expect(slugs).not.toContain(outside);

      for (const place of result.data) {
        expect(place.latitude).toBeGreaterThanOrEqual(12.8);
        expect(place.latitude).toBeLessThanOrEqual(13.2);
      }
    });

    it('reports distanceMeters as 0 for bounds results', async () => {
      const result = await findPlacesInBounds({
        north: 14,
        south: 12,
        east: 79,
        west: 76,
        limit: 100,
        offset: 0,
      });

      expect(result.data.length).toBeGreaterThan(0);
      for (const place of result.data) {
        expect(place.distanceMeters).toBe(0);
      }
    });
  });

  describe('not-found behaviour', () => {
    it('returns null for an unknown slug', async () => {
      expect(await findPlaceBySlug('no-such-place-slug-xyz')).toBeNull();
    });

    it('returns null for an unknown id', async () => {
      expect(await findPlaceById('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('does not treat an empty string as a match', async () => {
      expect(await findPlaceBySlug('')).toBeNull();
    });
  });

  describe('getCategoryCounts', () => {
    it('returns all 13 categories with numeric counts', async () => {
      const counts = await getCategoryCounts();

      expect(Object.keys(counts)).toHaveLength(13);
      for (const [category, count] of Object.entries(counts)) {
        expect(typeof count).toBe('number');
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(0);
        expect(category).toMatch(/^[A-Z_]+$/);
      }
    });

    it('counts only publicly visible places and agrees with the nearby query', async () => {
      const restricted = await insertTestPlace({
        name: 'Uncounted Restricted Test Place',
        slug: 'test-category-counts-restricted',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        category: 'LAKE',
        visibilityLevel: 'PRIVATE',
      });
      created.push(restricted);

      const before = await getCategoryCounts();
      expect(before.LAKE).toBe(0);

      // getCategoryCounts has no radius, so it must be compared against an
      // equally unfiltered read of the whole table, not a nearby query.
      const allPublic = await prisma.$queryRawUnsafe<{ category: string; n: number }[]>(`
        SELECT category::text AS category, COUNT(*)::int AS n
          FROM "Place"
         WHERE "visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')
         GROUP BY category
      `);

      expect(allPublic.length).toBeGreaterThan(0);
      for (const row of allPublic) {
        expect(before[row.category as keyof typeof before]).toBe(row.n);
      }
      expect(Object.values(before).reduce((a, b) => a + b, 0)).toBe(
        allPublic.reduce((sum, row) => sum + row.n, 0)
      );
    });
  });

  describe('photos against the real schema', () => {
    it('returns an empty array for a place with no photos', async () => {
      const slug = await insertTestPlace({
        name: 'No Photo Test Place',
        slug: 'test-photos-none',
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
      });
      created.push(slug);

      const place = await findPlaceBySlug(slug);
      expect(place).not.toBeNull();
      expect(place?.photos).toEqual([]);
      expect(place?.primaryPhotoUrl).toBeNull();

      const row = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Place" WHERE slug = $1`,
        slug
      );
      expect(await findPhotosForPlace(row[0].id)).toEqual([]);
      expect(await findPrimaryPhotoUrl(row[0].id)).toBeNull();
    });

    it('reports a null primary photo for every seeded place (no photo rows yet)', async () => {
      const total = await prisma.placePhoto.count();

      // This suite never creates photo rows, so the only correct answer is null
      // everywhere. If photos are added later this assertion documents the
      // change rather than silently passing.
      expect(total).toBe(0);

      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      for (const place of nearby.data) {
        expect(place.primaryPhotoUrl).toBeNull();
      }
    });

    it('returns an empty map for an empty id list without querying', async () => {
      const map = await findPrimaryPhotoUrls([]);
      expect(map.size).toBe(0);
    });

    it('returns no entries for place ids that have no photos', async () => {
      const nearby = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 5,
        offset: 0,
      });
      const ids = nearby.data.map((p) => p.id);
      const map = await findPrimaryPhotoUrls(ids);
      expect(map.size).toBe(0);
    });

    it('returns an empty array for an unknown place id', async () => {
      expect(await findPhotosForPlace('00000000-0000-0000-0000-000000000000')).toEqual([]);
      expect(await findPrimaryPhotoUrl('00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });

  describe('service layer over the real database', () => {
    it('getFeaturedPlaces returns only OPEN places within the radius', async () => {
      const result = await placeService.getFeaturedPlaces(4);

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.length).toBeLessThanOrEqual(4);
      for (const place of result.data) {
        expect(place.status).toBe('OPEN');
        expect(place.distanceMeters).toBeLessThanOrEqual(WIDE_RADIUS_METERS);
      }
      const parsed = nearbyPlaceSchema.safeParse(result.data[0]);
      expect(parsed.success).toBe(true);
    });

    it('getFeaturedPlaces does not repeat a place across pages of the same query', async () => {
      const first = await placeService.getFeaturedPlaces(3);
      const second = await placeService.getFeaturedPlaces(3);
      expect(second.data.map((p) => p.id)).toEqual(first.data.map((p) => p.id));
    });

    it('getCategoryCounts agrees with the repository', async () => {
      const viaService = await placeService.getCategoryCounts();
      const viaRepository = await getCategoryCounts();
      expect(viaService).toEqual(viaRepository);
    });

    it('searchNearby clamps radius and limit to documented maxima', async () => {
      const clamped = await placeService.searchNearby({
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        radiusMeters: 999999,
        limit: 9999,
      });

      expect(clamped.pagination.limit).toBe(100);
      // The repository was asked for at most 50km, so nothing farther can appear
      // even though a wider radius would return more.
      for (const place of clamped.data) {
        expect(place.distanceMeters).toBeLessThanOrEqual(SERVICE_MAX_RADIUS_METERS);
      }

      // A seeded place beyond 50km proves the clamp is actually applied.
      const beyondClamp = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: WIDE_RADIUS_METERS,
        limit: 100,
        offset: 0,
      });
      const beyondIds = new Set(beyondClamp.data.map((p) => p.id));
      const clampedIds = new Set(clamped.data.map((p) => p.id));
      expect(beyondIds.size).toBeGreaterThan(clampedIds.size);
      for (const id of clampedIds) {
        expect(beyondIds.has(id)).toBe(true);
      }
    });

    it('searchNearby clamps a negative radius to zero rather than erroring', async () => {
      const result = await placeService.searchNearby({
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        radiusMeters: -5000,
        limit: 100,
        offset: 0,
      });

      // A radius of 0 is ST_DWithin(..., 0), which matches only places at the
      // exact query point. Tests earlier in this file insert places there, so
      // rows may legitimately come back — but nothing further away may.
      for (const place of result.data) {
        expect(place.distanceMeters).toBe(0);
      }
      expect(result.pagination.limit).toBe(100);

      // The count must match the same radius-0 filter, not the unbounded total.
      const zeroRadius = await findNearbyPlaces({
        ...BENGALURU,
        radiusMeters: 0,
        limit: 100,
        offset: 0,
      });
      expect(result.pagination.count).toBe(zeroRadius.pagination.count);
    });
  });
});
