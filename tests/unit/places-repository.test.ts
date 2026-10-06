// Unit tests for places repository
// These test the query building logic without requiring a database

import {
  buildFilterWhere,
  findNearbyPlaces,
  findPlacesInBounds,
  findPlaceById,
  findPlaceBySlug,
} from '@/features/places/repositories';
import { nearbyPlaceSchema } from '@/features/places/nearby';
import { prisma } from '@/lib/db/prisma';
import type { PlaceCategory, PlaceStatus } from '@prisma/client';

// The database driver is mocked. These tests capture the REAL SQL the
// repository executes and assert it against the shared response contract —
// mocked API tests can't catch a SELECT/schema mismatch because they never
// run the queries.
jest.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $queryRawUnsafe: jest.fn(),
    officialSource: { findMany: jest.fn() },
    placePhoto: { findMany: jest.fn() },
  };
  return { prisma: mockPrisma, default: mockPrisma };
});

describe('Places Repository - Query Building', () => {
  describe('buildFilterWhere', () => {
    it('returns empty where clause when no filters provided', () => {
      const { where, params } = buildFilterWhere(undefined, undefined, undefined);
      expect(where).toBe(
        'WHERE "visibilityLevel" IN (\'PUBLIC_EXACT\', \'PUBLIC_APPROXIMATE\')'
      );
      expect(params).toEqual([]);
    });

    it('includes category filter', () => {
      const { where, params } = buildFilterWhere('TREK', undefined, undefined);
      expect(where).toContain('category = $1::place_category');
      expect(where).toContain('"visibilityLevel" IN (\'PUBLIC_EXACT\', \'PUBLIC_APPROXIMATE\')');
      expect(params).toEqual(['TREK']);
    });

    it('includes status filter', () => {
      const { where, params } = buildFilterWhere(undefined, 'OPEN', undefined);
      expect(where).toContain('status = $1::place_status');
      expect(params).toEqual(['OPEN']);
    });

    it('includes difficulty filter', () => {
      const { where, params } = buildFilterWhere(undefined, undefined, 3);
      expect(where).toContain('difficulty = $1');
      expect(params).toEqual([3]);
    });

    it('combines all filters with AND', () => {
      const { where, params } = buildFilterWhere('TREK', 'OPEN', 2);
      expect(where).toContain('category = $1::place_category');
      expect(where).toContain('status = $2::place_status');
      expect(where).toContain('difficulty = $3');
      expect(where).toContain('"visibilityLevel" IN (\'PUBLIC_EXACT\', \'PUBLIC_APPROXIMATE\')');
      expect(params).toEqual(['TREK', 'OPEN', 2]);
    });

    it('excludes PRIVATE visibility level', () => {
      const { where } = buildFilterWhere(undefined, undefined, undefined);
      expect(where).not.toContain('PRIVATE');
      expect(where).not.toContain('MODERATOR_ONLY');
      expect(where).not.toContain('VERIFIED_COMMUNITY_ONLY');
    });

    it('includes only PUBLIC_EXACT and PUBLIC_APPROXIMATE visibility levels', () => {
      const { where } = buildFilterWhere(undefined, undefined, undefined);
      expect(where).toContain('PUBLIC_EXACT');
      expect(where).toContain('PUBLIC_APPROXIMATE');
    });
  });
});

describe('PlaceResult contract (shared nearby/bounds response schema)', () => {
  const queryRawUnsafe = prisma.$queryRawUnsafe as unknown as jest.Mock;
  const capturedSql: string[] = [];

  beforeEach(() => {
    capturedSql.length = 0;
    queryRawUnsafe.mockImplementation((sql: string) => {
      capturedSql.push(sql);
      if (sql.includes('COUNT(')) {
        return Promise.resolve([{ total: 0n }]);
      }
      return Promise.resolve([]);
    });
  });

  /** The query that returns result rows (not its COUNT(*) companion). */
  function resultQuerySql(): string {
    const sql = capturedSql.find((statement) => statement.includes('as "distanceMeters"'));
    if (!sql) {
      throw new Error(`No result query captured (captured ${capturedSql.length} statements)`);
    }
    return sql;
  }

  /** The column list of a result query: everything between SELECT and FROM "Place". */
  function selectClause(sql: string): string {
    const match = sql.match(/SELECT([\s\S]*?)FROM\s+"Place"/);
    if (!match) throw new Error('Could not locate the SELECT clause');
    return match[1];
  }

  /** Splits a SELECT list on top-level commas (ignores commas inside calls). */
  function splitSelectItems(clause: string): string[] {
    const items: string[] = [];
    let depth = 0;
    let current = '';
    for (const character of clause) {
      if (character === '(') depth++;
      if (character === ')') depth--;
      if (character === ',' && depth === 0) {
        items.push(current);
        current = '';
      } else {
        current += character;
      }
    }
    if (current.trim()) items.push(current);
    return items.map((item) => item.trim());
  }

  /** The column name a SELECT item yields to the client (alias-aware). */
  function resultKeyOf(item: string): string | null {
    const alias = item.match(/\bas\s+(?:"([^"]+)"|([A-Za-z0-9_]+))\s*$/i);
    if (alias) return alias[1] ?? alias[2];
    const column = item.match(/^"([A-Za-z0-9_]+)"$/);
    if (column) return column[1];
    const bare = item.match(/^[A-Za-z0-9_]+$/);
    if (bare) return item;
    return null;
  }

  // Every required contract key must appear in the SELECT. `primaryPhotoUrl` is
  // required (nullable, but always selected), so these tests fail if the LATERAL
  // primary-photo join is ever dropped from a query.
const contractKeys = Object.entries(nearbyPlaceSchema.shape)
  .filter(([, schema]) => !schema.isOptional())
  .map(([key]) => key);

  /** Contract keys absent from the SELECT clause — [] means the contract is covered. */
  function missingContractColumns(sql: string): string[] {
    const clause = selectClause(sql);
    return contractKeys.filter(
      (key) => !new RegExp(`(?:^|[^A-Za-z0-9_])"?${key}"?(?![A-Za-z0-9_])`).test(clause)
    );
  }

  it('findNearbyPlaces selects every column required by the response contract', async () => {
    await findNearbyPlaces({
      latitude: 12.9716,
      longitude: 77.5946,
      radiusMeters: 50000,
      limit: 20,
      offset: 0,
    });
    expect(missingContractColumns(resultQuerySql())).toEqual([]);
  });

  it('findPlacesInBounds selects every column required by the response contract', async () => {
    await findPlacesInBounds({
      north: 13.2,
      south: 12.8,
      east: 77.8,
      west: 77.2,
      limit: 20,
      offset: 0,
    });
    expect(missingContractColumns(resultQuerySql())).toEqual([]);
  });

  it('findPlaceById selects every column required by the response contract', async () => {
    await findPlaceById('some-id');
    expect(missingContractColumns(resultQuerySql())).toEqual([]);
  });

  it('findPlaceBySlug selects every column required by the response contract', async () => {
    await findPlaceBySlug('some-slug');
    expect(missingContractColumns(resultQuerySql())).toEqual([]);
  });

  // End-to-end shape check: build a row exactly as the database would — with
  // only the columns the real SELECT returns — and validate it against the
  // shared Zod contract the client enforces on /api/places/nearby and
  // /api/places/bounds. This is the regression net for the D1 mismatch.
  describe('simulated database row parses against the client contract', () => {
    const SIMULATED_VALUES: Record<string, unknown> = {
      id: 'row-1',
      name: 'Row One',
      slug: 'row-one',
      category: 'TREK',
      shortDescription: null,
      latitude: 12.9,
      longitude: 77.5,
      distanceMeters: 0,
      difficulty: null,
      status: 'OPEN',
      trustLevel: 'VERIFIED',
      visibilityLevel: 'PUBLIC_EXACT',
      trustScore: 80,
      hasParking: true,
      hasWater: true,
      hasNetwork: true,
      permitRequired: false,
      trailDistanceKm: null,
      primaryPhotoUrl: null,
      description: null,
    };

    function simulatedRowFrom(sql: string): Record<string, unknown> {
      const keys = splitSelectItems(selectClause(sql))
        .map(resultKeyOf)
        .filter((key): key is string => key !== null);
      return Object.fromEntries(keys.map((key) => [key, SIMULATED_VALUES[key] ?? null]));
    }

    function expectRowToSatisfyContract(sql: string): void {
      const row = simulatedRowFrom(sql);
      const parsed = nearbyPlaceSchema.safeParse(row);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    }

    it('bounds results (findPlacesInBounds)', async () => {
      await findPlacesInBounds({
        north: 13.2,
        south: 12.8,
        east: 77.8,
        west: 77.2,
        limit: 20,
        offset: 0,
      });
      expectRowToSatisfyContract(resultQuerySql());
    });

    it('nearby results (findNearbyPlaces)', async () => {
      await findNearbyPlaces({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 50000,
        limit: 20,
        offset: 0,
      });
      expectRowToSatisfyContract(resultQuerySql());
    });

    it('detail results (findPlaceBySlug)', async () => {
      await findPlaceBySlug('some-slug');
      expectRowToSatisfyContract(resultQuerySql());
    });
  });
});

describe('Place repository — primary photo resolution (no N+1)', () => {
  const queryRawUnsafe = prisma.$queryRawUnsafe as unknown as jest.Mock;
  const officialSourceFindMany = prisma.officialSource.findMany as unknown as jest.Mock;
  const placePhotoFindMany = (prisma as unknown as { placePhoto: { findMany: jest.Mock } }).placePhoto
    .findMany;

  let capturedSql: string[] = [];

  beforeEach(() => {
    capturedSql = [];
    officialSourceFindMany.mockReset();
    placePhotoFindMany.mockReset();
    queryRawUnsafe.mockImplementation((sql: string) => {
      capturedSql.push(sql);
      if (sql.includes('COUNT(')) return Promise.resolve([{ total: 0n }]);
      return Promise.resolve([]);
    });
    officialSourceFindMany.mockResolvedValue([]);
    placePhotoFindMany.mockResolvedValue([]);
  });

  /** Statements that return result rows (not COUNT companions). */
  function rowQueries(): string[] {
    return capturedSql.filter((sql) => !sql.includes('COUNT('));
  }

  const nearbyArgs = {
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 50000,
    limit: 20,
    offset: 0,
  };
  const boundsArgs = {
    north: 13.2,
    south: 12.8,
    east: 77.8,
    west: 77.2,
    limit: 20,
    offset: 0,
  };

  describe('the LATERAL join', () => {
    it('findNearbyPlaces resolves the primary photo in the same statement', async () => {
      await findNearbyPlaces(nearbyArgs);
      const sql = rowQueries()[0];
      expect(sql).toContain('LEFT JOIN LATERAL');
      expect(sql).toContain('FROM "PlacePhoto"');
      expect(sql).toContain('pp.url AS "primaryPhotoUrl"');
    });

    it('findPlacesInBounds resolves the primary photo in the same statement', async () => {
      await findPlacesInBounds(boundsArgs);
      const sql = rowQueries()[0];
      expect(sql).toContain('LEFT JOIN LATERAL');
      expect(sql).toContain('pp.url AS "primaryPhotoUrl"');
    });

    it('findPlaceById resolves the primary photo in the same statement', async () => {
      await findPlaceById('some-id');
      const sql = rowQueries()[0];
      expect(sql).toContain('LEFT JOIN LATERAL');
      expect(sql).toContain('pp.url AS "primaryPhotoUrl"');
    });

    it('findPlaceBySlug resolves the primary photo in the same statement', async () => {
      await findPlaceBySlug('some-slug');
      const sql = rowQueries()[0];
      expect(sql).toContain('LEFT JOIN LATERAL');
      expect(sql).toContain('pp.url AS "primaryPhotoUrl"');
    });

    it('uses the deterministic ordering inside the join', async () => {
      await findNearbyPlaces(nearbyArgs);
      expect(rowQueries()[0]).toContain(
        'ORDER BY "isPrimary" DESC, "sortOrder" ASC, "createdAt" ASC'
      );
    });

    it('keeps the COUNT companion free of the photo join', async () => {
      await findNearbyPlaces(nearbyArgs);
      const countSql = capturedSql.find((sql) => sql.includes('COUNT('));
      expect(countSql).not.toContain('PlacePhoto');
    });

    it('does not store the photo url on the Place table', async () => {
      await findNearbyPlaces(nearbyArgs);
      // The SELECT only reads Place columns plus the lateral; no INSERT/UPDATE
      // ever writes a photo column back to Place.
      expect(rowQueries()[0]).not.toMatch(/INSERT\s+INTO\s+"Place"/i);
    });
  });

  describe('query count stays constant (no N+1)', () => {
    it('findNearbyPlaces issues one row query and one count query', async () => {
      await findNearbyPlaces(nearbyArgs);
      expect(rowQueries()).toHaveLength(1);
      expect(capturedSql.filter((s) => s.includes('COUNT('))).toHaveLength(1);
    });

    it('findNearbyPlaces does not query photos per returned row', async () => {
      queryRawUnsafe.mockImplementation((sql: string) => {
        capturedSql.push(sql);
        if (sql.includes('COUNT(')) return Promise.resolve([{ total: 50n }]);
        return Promise.resolve(
          Array.from({ length: 50 }, (_, i) => ({
            id: `place-${i}`,
            name: `Place ${i}`,
            slug: `place-${i}`,
            category: 'TREK',
            shortDescription: null,
            latitude: 13,
            longitude: 77.5,
            distanceMeters: 100,
            difficulty: null,
            status: 'OPEN',
            trustLevel: 'VERIFIED',
            visibilityLevel: 'PUBLIC_EXACT',
            trustScore: 50,
            hasParking: false,
            hasWater: false,
            hasNetwork: false,
            permitRequired: false,
            trailDistanceKm: null,
            primaryPhotoUrl: null,
          }))
        );
      });

      const result = await findNearbyPlaces(nearbyArgs);
      expect(result.data).toHaveLength(50);
      // Two statements total, regardless of 50 rows.
      expect(capturedSql).toHaveLength(2);
      expect(placePhotoFindMany).not.toHaveBeenCalled();
    });

    it('findPlacesInBounds issues one row query and one count query', async () => {
      await findPlacesInBounds(boundsArgs);
      expect(rowQueries()).toHaveLength(1);
      expect(capturedSql.filter((s) => s.includes('COUNT('))).toHaveLength(1);
    });

    it('findPlaceById issues exactly one query', async () => {
      await findPlaceById('some-id');
      expect(capturedSql).toHaveLength(1);
    });

    it('findPlaceBySlug issues a fixed number of queries regardless of photo count', async () => {
      placePhotoFindMany.mockResolvedValue(
        Array.from({ length: 25 }, (_, i) => ({
          id: `photo-${i}`,
          placeId: 'place-1',
          url: `https://example.com/${i}.jpg`,
          thumbnailUrl: null,
          caption: null,
          license: 'CC0',
          attribution: 'Public domain',
          altText: `Photo ${i}`,
          sourceUrl: null,
          photographerName: null,
          isPrimary: i === 0,
          sortOrder: i,
        }))
      );
      queryRawUnsafe.mockImplementation((sql: string) => {
        capturedSql.push(sql);
        if (sql.includes('COUNT(')) return Promise.resolve([{ total: 0n }]);
        return Promise.resolve([
          {
            id: 'place-1',
            name: 'Place One',
            slug: 'place-one',
            category: 'TREK',
            shortDescription: null,
            description: null,
            latitude: 13,
            longitude: 77.5,
            distanceMeters: 0,
            difficulty: null,
            status: 'OPEN',
            trustLevel: 'VERIFIED',
            visibilityLevel: 'PUBLIC_EXACT',
            trustScore: 50,
            hasParking: false,
            hasWater: false,
            hasNetwork: false,
            permitRequired: false,
            trailDistanceKm: null,
            primaryPhotoUrl: 'https://example.com/0.jpg',
          },
        ]);
      });

      const result = await findPlaceBySlug('place-one');
      expect(result?.photos).toHaveLength(25);
      // 1 place query + 1 sources query + 1 photos query — not 25.
      expect(capturedSql).toHaveLength(1);
      expect(officialSourceFindMany).toHaveBeenCalledTimes(1);
      expect(placePhotoFindMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('detail photos', () => {
    const detailRow = {
      id: 'place-1',
      name: 'Place One',
      slug: 'place-one',
      category: 'TREK',
      shortDescription: null,
      description: 'A description',
      latitude: 13,
      longitude: 77.5,
      distanceMeters: 0,
      difficulty: null,
      status: 'OPEN',
      trustLevel: 'VERIFIED',
      visibilityLevel: 'PUBLIC_EXACT',
      trustScore: 50,
      hasParking: false,
      hasWater: false,
      hasNetwork: false,
      permitRequired: false,
      trailDistanceKm: null,
      primaryPhotoUrl: null,
    };

    beforeEach(() => {
      queryRawUnsafe.mockImplementation((sql: string) => {
        capturedSql.push(sql);
        return Promise.resolve([detailRow]);
      });
    });

    it('returns an empty photos array for a place with zero photos', async () => {
      const result = await findPlaceBySlug('place-one');
      expect(result?.photos).toEqual([]);
    });

    it('returns photos alongside the existing sources relation', async () => {
      officialSourceFindMany.mockResolvedValue([
        { id: 's1', name: 'Karnataka Tourism', type: 'OFFICIAL_TOURISM_BOARD', url: 'https://x' },
      ]);
      const result = await findPlaceBySlug('place-one');
      expect(result?.sources).toHaveLength(1);
      expect(result?.photos).toEqual([]);
    });

    it('exposes validated provenance on each detail photo', async () => {
      placePhotoFindMany.mockResolvedValue([
        {
          id: 'photo-1',
          placeId: 'place-1',
          url: 'https://example.com/1.jpg',
          thumbnailUrl: 'https://example.com/1-thumb.jpg',
          caption: 'The fort',
          license: 'CC_BY_SA',
          attribution: 'Jane Doe',
          altText: 'Hill fort at sunrise',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:1.jpg',
          photographerName: 'Jane Doe',
          isPrimary: true,
          sortOrder: 0,
        },
      ]);
      const result = await findPlaceBySlug('place-one');
      expect(result?.photos[0]).toEqual({
        id: 'photo-1',
        placeId: 'place-1',
        url: 'https://example.com/1.jpg',
        thumbnailUrl: 'https://example.com/1-thumb.jpg',
        caption: 'The fort',
        license: 'CC_BY_SA',
        attribution: 'Jane Doe',
        altText: 'Hill fort at sunrise',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:1.jpg',
        photographerName: 'Jane Doe',
        isPrimary: true,
        sortOrder: 0,
      });
    });

    it('returns null for a place that does not exist, without querying photos', async () => {
      queryRawUnsafe.mockImplementation(() => Promise.resolve([]));
      const result = await findPlaceBySlug('missing');
      expect(result).toBeNull();
      expect(placePhotoFindMany).not.toHaveBeenCalled();
    });
  });
});