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
      // Create place without location first, then set it
      const created = await prisma.place.create({
        data: {
          name: place.name,
          slug: place.slug,
          category: place.category,
          shortDescription: place.shortDescription,
          difficulty: place.difficulty,
          status: place.status,
          trustLevel: place.trustLevel,
          visibilityLevel: place.visibilityLevel,
          // location will be set via raw SQL
        },
      });

      await prisma.$executeRawUnsafe(
        `UPDATE "Place" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE slug = $3`,
        place.longitude,
        place.latitude,
        place.slug
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