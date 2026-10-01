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

  const contractKeys = Object.keys(nearbyPlaceSchema.shape);

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