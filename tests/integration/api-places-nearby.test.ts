// Integration tests for GET /api/places/nearby endpoint
// These tests hit the actual API endpoint with database queries

import { prisma } from '@/lib/db/prisma';
import { setupTestPlaces, cleanupTestPlaces, TEST_PLACES } from '@/tests/db-setup';

// Test helper to make API requests
async function makeNearbyRequest(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );

  // Simulate the request handling without HTTP
  const { nearbyPlacesQuerySchema } = await import('@/app/api/places/nearby/schema');
  const { placeService } = await import('@/features/places/services');

  // Validate parameters
  const validatedParams = nearbyPlacesQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  // Execute service call
  const result = await placeService.searchNearby({
    latitude: validatedParams.lat,
    longitude: validatedParams.lng,
    radiusMeters: validatedParams.radius,
    limit: validatedParams.limit,
    offset: validatedParams.offset,
    category: validatedParams.category,
    status: validatedParams.status,
    difficulty: validatedParams.difficulty,
  });

  return result;
}

describe('Integration: GET /api/places/nearby', () => {
  let testSlugs: string[] = [];

  beforeAll(async () => {
    // Set up test places in the database
    testSlugs = await setupTestPlaces();
  });

  afterAll(async () => {
    // Clean up test places
    await cleanupTestPlaces(testSlugs);
    await prisma.$disconnect();
  });

  describe('Valid requests', () => {
    it('returns places within radius of Bangalore city center', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 10000, // 10km
      });

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Verify structure of first result
      const place = result.data[0];
      expect(place).toHaveProperty('id');
      expect(place).toHaveProperty('name');
      expect(place).toHaveProperty('slug');
      expect(place).toHaveProperty('category');
      expect(place).toHaveProperty('latitude');
      expect(place).toHaveProperty('longitude');
      expect(place).toHaveProperty('distanceMeters');
      expect(place).toHaveProperty('status');
      expect(place).toHaveProperty('trustLevel');
      expect(place).toHaveProperty('visibilityLevel');
    });

    it('orders results by distance ascending', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000, // 50km
      });

      expect(result.data.length).toBeGreaterThan(1);

      // Verify distances are in ascending order
      for (let i = 1; i < result.data.length; i++) {
        const prevDistance = result.data[i - 1].distanceMeters;
        const currDistance = result.data[i].distanceMeters;
        expect(currDistance).toBeGreaterThanOrEqual(prevDistance);
      }
    });

    it('respects radius parameter', async () => {
      const smallRadius = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 5000, // 5km
      });

      const largeRadius = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000, // 50km
      });

      // Larger radius should return same or more results
      expect(largeRadius.data.length).toBeGreaterThanOrEqual(smallRadius.data.length);

      // All results should be within specified radius
      for (const place of smallRadius.data) {
        expect(place.distanceMeters).toBeLessThanOrEqual(5000);
      }
    });

    it('filters by category', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        category: 'TREK',
      });

      // All results should be TREKs
      for (const place of result.data) {
        expect(place.category).toBe('TREK');
      }
    });

    it('filters by status', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        status: 'OPEN',
      });

      // All results should be OPEN
      for (const place of result.data) {
        expect(place.status).toBe('OPEN');
      }
    });

    it('filters by difficulty', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        difficulty: 2,
      });

      // All results should have difficulty 2
      for (const place of result.data) {
        expect(place.difficulty).toBe(2);
      }
    });

    it('excludes PRIVATE visibility places from public results', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
      });

      // No PRIVATE places should be returned
      for (const place of result.data) {
        expect(place.visibilityLevel).not.toBe('PRIVATE');
        expect(place.visibilityLevel).not.toBe('MODERATOR_ONLY');
      }
    });

    it('respects limit parameter', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        limit: 3,
      });

      expect(result.data.length).toBeLessThanOrEqual(3);
      expect(result.pagination.limit).toBe(3);
    });

    it('respects offset parameter for pagination', async () => {
      const firstPage = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        limit: 2,
        offset: 0,
      });

      const secondPage = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        limit: 2,
        offset: 2,
      });

      // Different pages should return different results
      if (firstPage.data.length > 0 && secondPage.data.length > 0) {
        expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      }
    });

    it('returns empty results for location with no nearby places', async () => {
      // Coordinates in the middle of nowhere (Arabian Sea)
      const result = await makeNearbyRequest({
        lat: 15.0,
        lng: 70.0,
        radius: 10000,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
    });

    it('returns pagination metadata', async () => {
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000,
        limit: 5,
        offset: 2,
      });

      expect(result.pagination).toMatchObject({
        limit: 5,
        offset: 2,
        count: expect.any(Number),
      });
    });
  });

  describe('Invalid requests', () => {
    it('rejects invalid latitude (too high)', async () => {
      await expect(
        makeNearbyRequest({
          lat: 91, // Invalid: > 90
          lng: 77.5946,
          radius: 10000,
        })
      ).rejects.toThrow();
    });

    it('rejects invalid latitude (too low)', async () => {
      await expect(
        makeNearbyRequest({
          lat: -91, // Invalid: < -90
          lng: 77.5946,
          radius: 10000,
        })
      ).rejects.toThrow();
    });

    it('rejects invalid longitude (too high)', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: 181, // Invalid: > 180
          radius: 10000,
        })
      ).rejects.toThrow();
    });

    it('rejects invalid longitude (too low)', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: -181, // Invalid: < -180
          radius: 10000,
        })
      ).rejects.toThrow();
    });

    it('rejects negative radius', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: 77.5946,
          radius: -1000, // Invalid: negative
        })
      ).rejects.toThrow();
    });

    it('rejects radius exceeding maximum (50km)', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: 77.5946,
          radius: 51000, // Invalid: > 50000
        })
      ).rejects.toThrow();
    });

    it('rejects invalid category', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: 77.5946,
          radius: 10000,
          category: 'INVALID_CATEGORY',
        })
      ).rejects.toThrow();
    });

    it('rejects limit exceeding maximum (100)', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: 77.5946,
          radius: 10000,
          limit: 101, // Invalid: > 100
        })
      ).rejects.toThrow();
    });

    it('rejects negative offset', async () => {
      await expect(
        makeNearbyRequest({
          lat: 12.9716,
          lng: 77.5946,
          radius: 10000,
          offset: -1, // Invalid: negative
        })
      ).rejects.toThrow();
    });
  });

  describe('Distance calculations', () => {
    it('calculates distance correctly for known coordinates', async () => {
      // Test place: "Test Trek Near Bangalore" at (12.9716, 77.5946)
      // Query from same location - distance should be ~0
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 1000,
      });

      const testPlace = result.data.find((p) => p.slug === 'test-trek-near-bangalore');
      expect(testPlace).toBeDefined();
      if (testPlace) {
        // Distance should be very small (within 10 meters due to floating point precision)
        expect(testPlace.distanceMeters).toBeLessThan(10);
      }
    });

    it('excludes places outside radius', async () => {
      // Test place: "Test Waterfall Far Away" at (11.9716, 76.5946)
      // This is ~100km from Bangalore
      const result = await makeNearbyRequest({
        lat: 12.9716,
        lng: 77.5946,
        radius: 50000, // 50km radius
      });

      const farPlace = result.data.find((p) => p.slug === 'test-waterfall-far-away');
      // Should not be in results as it's beyond 50km
      expect(farPlace).toBeUndefined();
    });
  });
});
