// Unit tests for places service
// Tests input validation, defaults, and clamping

import { placeService } from '@/features/places/services';

// Mock the repository
jest.mock('@/features/places/repositories', () => ({
  findNearbyPlaces: jest.fn(),
  findPlacesInBounds: jest.fn(),
  findPlaceById: jest.fn(),
  findPlaceBySlug: jest.fn(),
}));

import { findNearbyPlaces, findPlacesInBounds } from '@/features/places/repositories';

const mockFindNearbyPlaces = findNearbyPlaces as jest.MockedFunction<typeof findNearbyPlaces>;
const mockFindPlacesInBounds = findPlacesInBounds as jest.MockedFunction<typeof findPlacesInBounds>;

describe('Place Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchNearby', () => {
    const mockResult = {
      data: [
        {
          id: '1',
          name: 'Test Place',
          slug: 'test-place',
          category: 'TREK' as const,
          shortDescription: 'A test place',
          latitude: 12.9716,
          longitude: 77.5946,
          distanceMeters: 1000,
          difficulty: 2,
          status: 'OPEN' as const,
          trustLevel: 'VERIFIED',
          visibilityLevel: 'PUBLIC_EXACT',
        },
      ],
      pagination: { limit: 20, offset: 0, count: 1 },
    };

    beforeEach(() => {
      mockFindNearbyPlaces.mockResolvedValue(mockResult);
    });

    it('applies default limit and offset', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 0,
        })
      );
    });

    it('clamps limit to maximum of 100', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        limit: 200,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('clamps limit to minimum of 1', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        limit: 0,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 1,
        })
      );
    });

    it('clamps offset to minimum of 0', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        offset: -10,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 0,
        })
      );
    });

    it('clamps radius to maximum of 50000 meters (50km)', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 100000,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          radiusMeters: 50000,
        })
      );
    });

    it('clamps radius to minimum of 0', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: -5000,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          radiusMeters: 0,
        })
      );
    });

    it('passes through category filter', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        category: 'WATERFALL',
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'WATERFALL',
        })
      );
    });

    it('passes through status filter', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        status: 'PERMIT_REQUIRED',
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PERMIT_REQUIRED',
        })
      );
    });

    it('passes through difficulty filter', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        difficulty: 4,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: 4,
        })
      );
    });

    it('passes through all filters together', async () => {
      await placeService.searchNearby({
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 10000,
        limit: 10,
        offset: 5,
        category: 'LAKE',
        status: 'OPEN',
        difficulty: 1,
      });

      expect(mockFindNearbyPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 5,
          category: 'LAKE',
          status: 'OPEN',
          difficulty: 1,
          radiusMeters: 10000,
        })
      );
    });
  });

  describe('searchInBounds', () => {
    const mockResult = {
      data: [],
      pagination: { limit: 50, offset: 0, count: 0 },
    };

    beforeEach(() => {
      mockFindPlacesInBounds.mockResolvedValue(mockResult);
    });

    it('applies default limit and offset', async () => {
      await placeService.searchInBounds({
        north: 13.0,
        south: 12.0,
        east: 78.0,
        west: 77.0,
      });

      expect(mockFindPlacesInBounds).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 0,
        })
      );
    });

    it('clamps limit to maximum of 200', async () => {
      await placeService.searchInBounds({
        north: 13.0,
        south: 12.0,
        east: 78.0,
        west: 77.0,
        limit: 500,
      });

      expect(mockFindPlacesInBounds).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 200,
        })
      );
    });

    it('passes through all bounds and filters', async () => {
      await placeService.searchInBounds({
        north: 13.0,
        south: 12.0,
        east: 78.0,
        west: 77.0,
        limit: 100,
        offset: 20,
        category: 'FORT',
        status: 'OPEN',
        difficulty: 3,
      });

      expect(mockFindPlacesInBounds).toHaveBeenCalledWith(
        expect.objectContaining({
          north: 13.0,
          south: 12.0,
          east: 78.0,
          west: 77.0,
          limit: 100,
          offset: 20,
          category: 'FORT',
          status: 'OPEN',
          difficulty: 3,
        })
      );
    });
  });
});