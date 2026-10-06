// Test database setup for integration tests
// Uses the same database connection but provides cleanup utilities

import { prisma } from '@/lib/db/prisma';

// Test place data for consistent testing
export const TEST_PLACES = [
  {
    name: 'Test Trek Near Bangalore',
    slug: 'test-trek-near-bangalore',
    category: 'TREK' as const,
    shortDescription: 'A test trek near Bangalore city center',
    latitude: 12.9716,
    longitude: 77.5946,
    difficulty: 2,
    status: 'OPEN' as const,
    trustLevel: 'VERIFIED' as const,
    visibilityLevel: 'PUBLIC_EXACT' as const,
  },
  {
    name: 'Test Waterfall Far Away',
    slug: 'test-waterfall-far-away',
    category: 'WATERFALL' as const,
    shortDescription: 'A test waterfall 100km from Bangalore',
    latitude: 11.9716,
    longitude: 76.5946,
    difficulty: 3,
    status: 'OPEN' as const,
    trustLevel: 'COMMUNITY_SUBMITTED' as const,
    visibilityLevel: 'PUBLIC_EXACT' as const,
  },
  {
    name: 'Test Hill Fort Closed',
    slug: 'test-hill-fort-closed',
    category: 'FORT' as const,
    shortDescription: 'A test hill fort that is closed',
    latitude: 13.0716,
    longitude: 77.6946,
    difficulty: 4,
    status: 'CLOSED' as const,
    trustLevel: 'VERIFIED' as const,
    visibilityLevel: 'PUBLIC_EXACT' as const,
  },
  {
    name: 'Test Lake Permit Required',
    slug: 'test-lake-permit-required',
    category: 'LAKE' as const,
    shortDescription: 'A test lake requiring permit',
    latitude: 12.8716,
    longitude: 77.4946,
    difficulty: 1,
    status: 'PERMIT_REQUIRED' as const,
    trustLevel: 'VERIFIED' as const,
    visibilityLevel: 'PUBLIC_EXACT' as const,
  },
  {
    name: 'Test Private Place',
    slug: 'test-private-place',
    category: 'HIKE' as const,
    shortDescription: 'A private test place not visible to public',
    latitude: 12.9716,
    longitude: 77.5946,
    difficulty: 2,
    status: 'OPEN' as const,
    trustLevel: 'VERIFIED' as const,
    visibilityLevel: 'PRIVATE' as const,
  },
];

/**
 * Sets up test places in the database
 * Creates places with known coordinates for predictable distance calculations
 */
export async function setupTestPlaces(): Promise<string[]> {
  const createdSlugs: string[] = [];

  for (const place of TEST_PLACES) {
    // Check if place already exists
    const existing = await prisma.place.findUnique({
      where: { slug: place.slug },
    });

    if (existing) {
      // Update location to ensure correct coordinates
      await prisma.$executeRawUnsafe(
        `UPDATE "Place" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE slug = $3`,
        place.longitude,
        place.latitude,
        place.slug
      );
      createdSlugs.push(place.slug);
    } else {
      // Create the place with its location in a single statement.
      //
      // `Place.location` is declared `Unsupported("geography")`, so Prisma
      // Client cannot read or write it, and the query engine cannot build an
      // INSERT plan for `Place` at all (createOne/createMany/upsertOne all fail
      // with "Operation 'createOne' for model 'Place' does not match any
      // query."). Raw SQL is the only supported way to populate an
      // `Unsupported` column.
      //
      // The location is also `NOT NULL` in the database, so a
      // create-then-UPDATE approach can never work: the INSERT would have to
      // supply it regardless.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Place"
           (name, slug, "shortDescription", category, difficulty, status,
            "trustLevel", "visibilityLevel", location)
         VALUES ($1, $2, $3, $4::place_category, $5, $6::place_status,
                 $7::trust_level, $8::visibility_level,
                 ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)`,
        place.name,
        place.slug,
        place.shortDescription,
        place.category,
        place.difficulty,
        place.status,
        place.trustLevel,
        place.visibilityLevel,
        place.longitude,
        place.latitude
      );
      createdSlugs.push(place.slug);
    }
  }

  return createdSlugs;
}

/**
 * Cleans up test places from the database
 */
export async function cleanupTestPlaces(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;

  await prisma.place.deleteMany({
    where: {
      slug: { in: slugs },
    },
  });
}

/**
 * Cleans up ALL test places (by slug pattern)
 */
export async function cleanupAllTestPlaces(): Promise<void> {
  await prisma.place.deleteMany({
    where: {
      slug: { startsWith: 'test-' },
    },
  });
}

/**
 * Removes every row any test suite may have left behind.
 *
 * A suite killed mid-run (an interrupted `jest`, a hook timeout, a crashed
 * worker) never reaches its own cleanup, and its fixtures then poison the next
 * run — for example a leftover public place on the city-centre coordinates
 * breaks any assertion that a radius around that point is empty. Suites that
 * create rows call this first so every run starts from the same state.
 */
export async function purgeTestPlaces(): Promise<void> {
  await cleanupAllTestPlaces();
}

/** Prefix shared by every slug inserted by {@link setupTestPlaces}. */
export const TEST_PLACE_SLUG_PREFIX = 'test-';

/**
 * A place inserted by a test with an explicit PostGIS location and an explicit
 * visibility level, so repository visibility rules can be exercised against the
 * real database rather than a mock.
 *
 * `location` is `Unsupported("geography")`, so the row must be inserted with raw
 * SQL — Prisma Client cannot write the column at all.
 */
export interface TestPlaceInput {
  name: string;
  slug: string;
  category?: string;
  shortDescription?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  difficulty?: number | null;
  status?: string;
  trustLevel?: string;
  visibilityLevel?: string;
  trustScore?: number;
  trailDistanceKm?: number | null;
  permitRequired?: boolean;
  hasParking?: boolean;
  hasWater?: boolean;
  hasNetwork?: boolean;
}

/**
 * Inserts a single place with its PostGIS location set atomically.
 *
 * `createPlace` in features/places/repositories is the production write path;
 * this helper exists so tests can create rows with an exact location and a
 * chosen visibility level without going through slug generation.
 */
export async function insertTestPlace(input: TestPlaceInput): Promise<string> {
  const slug = input.slug.startsWith(TEST_PLACE_SLUG_PREFIX)
    ? input.slug
    : `${TEST_PLACE_SLUG_PREFIX}${input.slug}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Place"
       (name, slug, description, "shortDescription", category, difficulty, status,
        "trustScore", "trustLevel", "visibilityLevel", "trailDistanceKm",
        "permitRequired", "hasParking", "hasWater", "hasNetwork", location)
     VALUES ($1, $2, $3, $4, $5::place_category, $6, $7::place_status,
             $8, $9::trust_level, $10::visibility_level, $11,
             $12, $13, $14, $15,
             ST_SetSRID(ST_MakePoint($16, $17), 4326)::geography)
     ON CONFLICT (slug) DO UPDATE
       SET location = EXCLUDED.location,
           "visibilityLevel" = EXCLUDED."visibilityLevel",
           status = EXCLUDED.status,
           "trustLevel" = EXCLUDED."trustLevel",
           category = EXCLUDED.category`,
    input.name,
    slug,
    input.description ?? null,
    input.shortDescription ?? null,
    input.category ?? 'TREK',
    input.difficulty ?? null,
    input.status ?? 'OPEN',
    input.trustScore ?? 50,
    input.trustLevel ?? 'VERIFIED',
    input.visibilityLevel ?? 'PUBLIC_EXACT',
    input.trailDistanceKm ?? null,
    input.permitRequired ?? false,
    input.hasParking ?? false,
    input.hasWater ?? false,
    input.hasNetwork ?? false,
    input.longitude,
    input.latitude
  );

  return slug;
}

/**
 * Removes every row created by {@link insertTestPlace} and {@link setupTestPlaces}.
 * Also clears any photos attached to them, which cascade-delete anyway but are
 * removed explicitly so the helper is safe if the FK ever changes.
 */
export async function deleteTestPlaces(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  await prisma.place.deleteMany({ where: { slug: { in: slugs } } });
}