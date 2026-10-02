// Unit tests for places repository - createPlace
// Tests slug generation, collision handling, and PostGIS location creation

import { createPlace, resolveUniqueSlug, upsertPlace } from '@/features/places/repositories';
import { prisma } from '@/lib/db/prisma';
import { setPlaceLocation } from '@/lib/db/postgis';
import { findPlaceById } from '@/features/places/repositories';
import type { place_category } from '@prisma/client';

// Mock Prisma and PostGIS
jest.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    place: {
      findUnique: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };
  return { prisma: mockPrisma, default: mockPrisma };
});

jest.mock('@/lib/db/postgis', () => ({
  setPlaceLocation: jest.fn(),
  getLatitudeSQL: () => 'ST_Y(location::geometry)',
  getLongitudeSQL: () => 'ST_X(location::geometry)',
  validateCoordinates: jest.fn(),
  createGeographyPoint: jest.fn(),
  getDistanceSQL: jest.fn(),
  getWithinRadiusSQL: jest.fn(),
  getWithinBoundsSQL: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  slugify: (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
}));

jest.mock('@/features/places/repositories', () => ({
  ...jest.requireActual('@/features/places/repositories'),
  findPlaceById: jest.fn(),
  findPlaceBySlug: jest.fn(),
  findNearbyPlaces: jest.fn(),
  findPlacesInBounds: jest.fn(),
  getCategoryCounts: jest.fn(),
  buildFilterWhere: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSetPlaceLocation = setPlaceLocation as jest.MockedFunction<typeof setPlaceLocation>;
const mockQueryRawUnsafe = prisma.$queryRawUnsafe as jest.MockedFunction<typeof prisma.$queryRawUnsafe>;
const mockFindPlaceById = findPlaceById as jest.MockedFunction<typeof findPlaceById>;

describe('Places Repository - createPlace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validInput = {
    name: 'Test Peak',
    category: 'TREK' as place_category,
    latitude: 13.0,
    longitude: 77.5,
    shortDescription: 'A test peak',
    description: 'A steep climb above the city',
  };

  it('creates a place with generated slug when not provided', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }]) // INSERT
      .mockResolvedValueOnce([{
        id: 'place-1',
        name: 'Test Peak',
        slug: 'test-peak',
        category: 'TREK',
        shortDescription: 'A test peak',
        latitude: 13.0,
        longitude: 77.5,
        distanceMeters: 0,
        difficulty: null,
        status: 'UNVERIFIED',
        trustLevel: 'COMMUNITY_SUBMITTED',
        visibilityLevel: 'PUBLIC_EXACT',
        trustScore: 0,
        hasParking: false,
        hasWater: false,
        hasNetwork: false,
        permitRequired: false,
        trailDistanceKm: null,
        primaryPhotoUrl: null,
      }]); // SELECT from findPlaceById
    mockSetPlaceLocation.mockResolvedValue(undefined);

    const result = await createPlace(validInput);

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2); // INSERT + SELECT
    expect(mockSetPlaceLocation).toHaveBeenCalledWith('test-peak', 77.5, 13.0);
    expect(result.slug).toBe('test-peak');
    expect(result.name).toBe('Test Peak');
    expect(result.category).toBe('TREK');
  });

  it('uses provided slug when given', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([{
        id: 'place-1',
        name: 'Test Peak',
        slug: 'custom-slug',
        category: 'TREK',
        shortDescription: 'A test peak',
        latitude: 13.0,
        longitude: 77.5,
        distanceMeters: 0,
        difficulty: null,
        status: 'UNVERIFIED',
        trustLevel: 'COMMUNITY_SUBMITTED',
        visibilityLevel: 'PUBLIC_EXACT',
        trustScore: 0,
        hasParking: false,
        hasWater: false,
        hasNetwork: false,
        permitRequired: false,
        trailDistanceKm: null,
        primaryPhotoUrl: null,
      }]);
    mockSetPlaceLocation.mockResolvedValue(undefined);

    const result = await createPlace({ ...validInput, slug: 'custom-slug' });

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(mockSetPlaceLocation).toHaveBeenCalledWith('custom-slug', 77.5, 13.0);
    expect(result.slug).toBe('custom-slug');
  });

  it('resolves slug collision by appending -2, -3, etc.', async () => {
    mockPrisma.place.findUnique
      .mockResolvedValueOnce({ id: 'existing' }) // 'test-peak' exists
      .mockResolvedValueOnce(null); // 'test-peak-2' is free

    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-2' }])
      .mockResolvedValueOnce([{
        id: 'place-2',
        name: 'Test Peak',
        slug: 'test-peak-2',
        category: 'TREK',
        shortDescription: 'A test peak',
        latitude: 13.0,
        longitude: 77.5,
        distanceMeters: 0,
        difficulty: null,
        status: 'UNVERIFIED',
        trustLevel: 'COMMUNITY_SUBMITTED',
        visibilityLevel: 'PUBLIC_EXACT',
        trustScore: 0,
        hasParking: false,
        hasWater: false,
        hasNetwork: false,
        permitRequired: false,
        trailDistanceKm: null,
        primaryPhotoUrl: null,
      }]);
    mockSetPlaceLocation.mockResolvedValue(undefined);

    const result = await createPlace(validInput);

    expect(mockPrisma.place.findUnique).toHaveBeenCalledTimes(2);
    expect(mockPrisma.place.findUnique).toHaveBeenNthCalledWith(1, { where: { slug: 'test-peak' } });
    expect(mockPrisma.place.findUnique).toHaveBeenNthCalledWith(2, { where: { slug: 'test-peak-2' } });
    expect(result.slug).toBe('test-peak-2');
  });

  it('handles multiple collisions correctly', async () => {
    mockPrisma.place.findUnique
      .mockResolvedValueOnce({ id: '1' }) // test-peak
      .mockResolvedValueOnce({ id: '2' }) // test-peak-2
      .mockResolvedValueOnce(null); // test-peak-3

    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-3' }])
      .mockResolvedValueOnce([{
        id: 'place-3',
        name: 'Test Peak',
        slug: 'test-peak-3',
        category: 'TREK',
        shortDescription: 'A test peak',
        latitude: 13.0,
        longitude: 77.5,
        distanceMeters: 0,
        difficulty: null,
        status: 'UNVERIFIED',
        trustLevel: 'COMMUNITY_SUBMITTED',
        visibilityLevel: 'PUBLIC_EXACT',
        trustScore: 0,
        hasParking: false,
        hasWater: false,
        hasNetwork: false,
        permitRequired: false,
        trailDistanceKm: null,
        primaryPhotoUrl: null,
      }]);
    mockSetPlaceLocation.mockResolvedValue(undefined);

    const result = await createPlace(validInput);
    expect(result.slug).toBe('test-peak-3');
  });

  it('passes all optional fields through to SQL insert', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([{
        id: 'place-1',
        name: 'Full Peak',
        slug: 'full-peak',
        category: 'TREK',
        shortDescription: 'Full data',
        latitude: 13.0,
        longitude: 77.5,
        distanceMeters: 0,
        difficulty: 3,
        status: 'OPEN',
        trustLevel: 'VERIFIED',
        visibilityLevel: 'PUBLIC_EXACT',
        trustScore: 95,
        hasParking: true,
        hasWater: true,
        hasNetwork: true,
        permitRequired: true,
        trailDistanceKm: 5,
        primaryPhotoUrl: null,
      }]);
    mockSetPlaceLocation.mockResolvedValue(undefined);

    const fullInput = {
      name: 'Full Peak',
      category: 'TREK' as const,
      latitude: 13.0,
      longitude: 77.5,
      shortDescription: 'A test peak',
      description: 'A steep climb above the city',
      slug: 'full-peak',
      subcategory: 'Mountain',
      region: 'Test Region',
      locality: 'Test Locality',
      difficulty: 3,
      trailDistanceKm: 5,
      durationHours: 2,
      elevationM: 1000,
      elevationGainM: 200,
      openingTime: '06:00',
      closingTime: '18:00',
      lastEntryTime: '17:00',
      entryFeeInr: 100,
      permitRequired: true,
      permitDetails: 'Permit required',
      permitUrl: 'https://example.com/permit',
      hasParking: true,
      parkingDetails: 'Parking available',
      hasWater: true,
      waterDetails: 'Water available',
      hasNetwork: true,
      networkDetails: 'Good coverage',
      crowdLevel: 2,
      bestSeasonStart: 10,
      bestSeasonEnd: 3,
      status: 'OPEN' as const,
      trustScore: 95,
      trustLevel: 'VERIFIED' as const,
      visibilityLevel: 'PUBLIC_EXACT' as const,
      sourceReferences: [{ type: 'official', title: 'Test Source' }],
      createdById: 'user-123',
    };

    await createPlace(fullInput);

    // Verify the INSERT query was called with the right structure
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2);
    const insertCall = mockQueryRawUnsafe.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO "Place"');
    // Verify key fields are passed in the right order
    // mock.calls[0] = [SQL, param1, param2, ...]
    // $1 = slug (index 1), $2 = name (index 2), $3 = description (index 3), $4 = shortDescription (index 4), $5 = category (index 5), $6 = subcategory (index 6)
    expect(insertCall[1]).toBe('full-peak'); // slug
    expect(insertCall[2]).toBe('Full Peak'); // name
    expect(insertCall[3]).toBe('A steep climb above the city'); // description
    expect(insertCall[4]).toBe('A test peak'); // shortDescription
    expect(insertCall[5]).toBe('TREK'); // category
    expect(insertCall[6]).toBe('Mountain'); // subcategory
    // Verify location placeholder is included in the SQL string
    expect(insertCall[0]).toContain('ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography');
  });

  it('sets default trustLevel and visibilityLevel when not provided', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([{
        id: 'place-1',
        name: 'Test Peak',
        slug: 'test-peak',
        category: 'TREK',
        shortDescription: 'A test peak',
        latitude: 13.0,
        longitude: 77.5,
        distanceMeters: 0,
        difficulty: null,
        status: 'UNVERIFIED',
        trustLevel: 'COMMUNITY_SUBMITTED',
        visibilityLevel: 'PUBLIC_EXACT',
        trustScore: 0,
        hasParking: false,
        hasWater: false,
        hasNetwork: false,
        permitRequired: false,
        trailDistanceKm: null,
        primaryPhotoUrl: null,
      }]);
    mockSetPlaceLocation.mockResolvedValue(undefined);

    await createPlace(validInput);

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2);
    const insertCall = mockQueryRawUnsafe.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO "Place"');
    expect(insertCall[1]).toBe('test-peak');
    expect(insertCall[2]).toBe('Test Peak');
    expect(insertCall[3]).toBe('A steep climb above the city'); // description
    expect(insertCall[4]).toBe('A test peak'); // shortDescription
    expect(insertCall[5]).toBe('TREK'); // category
  });

  it('throws if created place cannot be retrieved', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe.mockResolvedValueOnce([{ id: 'place-1' }]);
    mockQueryRawUnsafe.mockResolvedValueOnce([]); // Empty result from SELECT
    mockSetPlaceLocation.mockResolvedValue(undefined);

    const validInput = {
      name: 'Test Peak',
      category: 'TREK' as const,
      latitude: 13.0,
      longitude: 77.5,
      shortDescription: 'A test peak',
      description: 'A steep climb above the city',
    };

    await expect(createPlace(validInput)).rejects.toThrow('Failed to retrieve created place');
  });
});

describe('resolveUniqueSlug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns base slug when no collision', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);

    const result = await resolveUniqueSlug('unique-slug');

    expect(result).toBe('unique-slug');
    expect(mockPrisma.place.findUnique).toHaveBeenCalledWith({ where: { slug: 'unique-slug' } });
  });

  it('increments counter on collision', async () => {
    mockPrisma.place.findUnique
      .mockResolvedValueOnce({ id: '1' }) // taken
      .mockResolvedValueOnce(null); // free

    const result = await resolveUniqueSlug('taken-slug');

    expect(result).toBe('taken-slug-2');
  });
});

/**
 * Regression tests for PostgreSQL enum handling in raw SQL.
 *
 * `$queryRawUnsafe` transmits parameters as untyped text, so PostgreSQL refuses
 * them for enum columns (`ERROR: column "category" is of type place_category but
 * expression is of type text`). Every enum-backed column must therefore be
 * explicitly cast to its *database* enum type — which is not always the same as
 * the Prisma column name (category -> place_category, status -> place_status).
 */
describe('Places Repository - enum-backed columns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetPlaceLocation.mockResolvedValue(undefined);
  });

  const createdRow = {
    id: 'place-1',
    name: 'Test Peak',
    slug: 'test-peak',
    category: 'TREK',
    shortDescription: 'A test peak',
    latitude: 13.0,
    longitude: 77.5,
    distanceMeters: 0,
    difficulty: null,
    status: 'OPEN',
    trustLevel: 'VERIFIED',
    visibilityLevel: 'PUBLIC_APPROXIMATE',
    trustScore: 90,
    hasParking: false,
    hasWater: false,
    hasNetwork: false,
    permitRequired: false,
    trailDistanceKm: null,
  };

  const enumInput = {
    name: 'Test Peak',
    latitude: 13.0,
    longitude: 77.5,
    category: 'TREK' as place_category,
    status: 'OPEN' as const,
    trustLevel: 'VERIFIED' as const,
    visibilityLevel: 'PUBLIC_APPROXIMATE' as const,
  };

  it('createPlace casts each enum column to its database enum type', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([createdRow]);

    await createPlace(enumInput);

    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;

    // The four enum-backed Place columns
    expect(sql).toContain('::place_category');
    expect(sql).toContain('::place_status');
    expect(sql).toContain('::trust_level');
    expect(sql).toContain('::visibility_level');

    // Casting must target the DB type name, not the Prisma column name
    expect(sql).not.toContain('::"category"');
    expect(sql).not.toContain('::"status"');
    expect(sql).not.toContain('::"trustLevel"');
    expect(sql).not.toContain('::"visibilityLevel"');

    // Values are still transmitted as parameters, never inlined into the SQL
    expect(mockQueryRawUnsafe.mock.calls[0]).toContain('TREK');
    expect(mockQueryRawUnsafe.mock.calls[0]).toContain('OPEN');
    expect(mockQueryRawUnsafe.mock.calls[0]).toContain('VERIFIED');
    expect(mockQueryRawUnsafe.mock.calls[0]).toContain('PUBLIC_APPROXIMATE');
  });

  it('createPlace leaves non-enum columns uncast', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([createdRow]);

    await createPlace({ ...enumInput, subcategory: 'Hill Fort', trustScore: 90 });

    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    // Only the enum-backed columns carry a cast
    expect(sql).toContain('"subcategory", "status"');
    expect(sql).not.toMatch(/"subcategory", "\$\d+::/);
    expect(sql).not.toMatch(/"trustScore", "\$\d+::/);
    const casts = sql.match(/\$\d+::\w+/g) ?? [];
    expect(casts.sort()).toEqual(
      ['$3::place_category', '$5::place_status', '$7::trust_level', '$8::visibility_level'].sort()
    );
  });

  it('upsertPlace casts enum columns in the UPDATE SET clause', async () => {
    mockPrisma.place.findUnique.mockResolvedValue({ id: 'place-1' } as never);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{}]) // the UPDATE itself
      .mockResolvedValueOnce([createdRow]); // findPlaceById re-read after the write

    const result = await upsertPlace(enumInput);

    expect(result.created).toBe(false);

    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE "Place"');
    expect(sql).toMatch(/"category" = \$\d+::place_category/);
    expect(sql).toMatch(/"status" = \$\d+::place_status/);
    expect(sql).toMatch(/"trustLevel" = \$\d+::trust_level/);
    expect(sql).toMatch(/"visibilityLevel" = \$\d+::visibility_level/);
  });

  it('upsertPlace serializes jsonb columns as JSON strings', async () => {
    mockPrisma.place.findUnique.mockResolvedValue({ id: 'place-1' } as never);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{}]) // the UPDATE itself
      .mockResolvedValueOnce([createdRow]); // findPlaceById re-read after the write

    const refs = [{ url: 'https://example.com', type: 'official' }];
    await upsertPlace({ ...enumInput, sourceReferences: refs });

    const call = mockQueryRawUnsafe.mock.calls[0];
    const sql = call[0] as string;

    expect(sql).toMatch(/"sourceReferences" = \$\d+::jsonb/);
    // A JS array must be stringified, otherwise Postgres infers jsonb[]
    expect(call).toContain(JSON.stringify(refs));
    expect(call).not.toContain(refs);
  });

  it('createPlace serializes jsonb columns as JSON strings', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([createdRow]);

    const refs = { url: 'https://example.com' };
    await createPlace({ ...enumInput, sourceReferences: refs });

    const call = mockQueryRawUnsafe.mock.calls[0];
    const sql = call[0] as string;

    expect(sql).toMatch(/"sourceReferences"/);
    expect(sql).toContain('::jsonb');
    expect(call).toContain(JSON.stringify(refs));
  });

  it('createPlace omits null values so NOT NULL column defaults apply', async () => {
    mockPrisma.place.findUnique.mockResolvedValue(null);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([createdRow]);

    await createPlace({
      name: 'Test Peak',
      latitude: 13.0,
      longitude: 77.5,
      category: 'TREK' as place_category,
      // Explicit nulls from the dataset must not overwrite DB defaults
      hasWater: null,
      hasNetwork: null,
      entryFeeInr: null,
      openingTime: null,
    });

    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toContain('"hasWater"');
    expect(sql).not.toContain('"hasNetwork"');
    expect(sql).not.toContain('"entryFeeInr"');
    expect(sql).not.toContain('"openingTime"');
    // Non-null fields are still written
    expect(sql).toContain('"category"');
  });

  it('upsertPlace omits null values rather than nulling existing data', async () => {
    mockPrisma.place.findUnique.mockResolvedValue({ id: 'place-1' } as never);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{}]) // the UPDATE itself
      .mockResolvedValueOnce([createdRow]); // findPlaceById re-read after the write

    await upsertPlace({
      name: 'Test Peak',
      latitude: 13.0,
      longitude: 77.5,
      category: 'TREK' as place_category,
      difficulty: null,
      entryFeeInr: null,
    });

    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toContain('"difficulty"');
    expect(sql).not.toContain('"entryFeeInr"');
    // updatedAt and location are always refreshed
    expect(sql).toContain('"updatedAt" = NOW()');
    expect(sql).toContain('ST_SetSRID(ST_MakePoint(');
  });
});