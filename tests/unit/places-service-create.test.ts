// Unit tests for places service - createPlace
// Tests validation, slug handling, and service-layer orchestration

import { placeService } from '@/features/places/services';
import { placeCreateSchema } from '@/lib/validation/schemas';

// Mock the repository
jest.mock('@/features/places/repositories', () => ({
  createPlace: jest.fn(),
  findNearbyPlaces: jest.fn(),
  findPlacesInBounds: jest.fn(),
  findPlaceById: jest.fn(),
  findPlaceBySlug: jest.fn(),
  getCategoryCounts: jest.fn(),
}));

import { createPlace } from '@/features/places/repositories';

const mockCreatePlace = createPlace as jest.MockedFunction<typeof createPlace>;

describe('Place Service - createPlace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validInput = {
    name: 'Service Test Peak',
    category: 'TREK' as const,
    latitude: 13.0,
    longitude: 77.5,
  };

  it('validates input using placeCreateSchema', async () => {
    mockCreatePlace.mockResolvedValue({
      id: 'place-1',
      name: 'Service Test Peak',
      slug: 'service-test-peak',
      category: 'TREK',
      shortDescription: null,
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
    });

    const result = await placeService.createPlace(validInput);

    expect(mockCreatePlace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Service Test Peak',
        category: 'TREK',
        latitude: 13.0,
        longitude: 77.5,
        createdById: undefined,
      })
    );
    expect(result.slug).toBe('service-test-peak');
  });

  it('passes userId as createdById', async () => {
    mockCreatePlace.mockResolvedValue({
      id: 'place-1',
      name: 'Service Test Peak',
      slug: 'service-test-peak',
      category: 'TREK',
      shortDescription: null,
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
    });

    await placeService.createPlace(validInput, 'user-123');

    expect(mockCreatePlace).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'user-123' })
    );
  });

  it('rejects invalid input (missing required fields)', async () => {
    await expect(
      placeService.createPlace({ name: 'Test' } as any)
    ).rejects.toThrow(); // Zod validation error

    expect(mockCreatePlace).not.toHaveBeenCalled();
  });

  it('rejects invalid latitude', async () => {
    await expect(
      placeService.createPlace({ ...validInput, latitude: 100 })
    ).rejects.toThrow();

    expect(mockCreatePlace).not.toHaveBeenCalled();
  });

  it('rejects invalid category', async () => {
    await expect(
      placeService.createPlace({ ...validInput, category: 'INVALID' as any })
    ).rejects.toThrow();

    expect(mockCreatePlace).not.toHaveBeenCalled();
  });

  it('applies default status UNVERIFIED when not provided', async () => {
    mockCreatePlace.mockResolvedValue({
      id: 'place-1',
      name: 'Service Test Peak',
      slug: 'service-test-peak',
      category: 'TREK',
      shortDescription: null,
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
    });

    await placeService.createPlace(validInput);

    // The validated input passed to repository should have status defaulted
    expect(mockCreatePlace).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'UNVERIFIED' })
    );
  });

  it('applies default visibilityLevel PUBLIC_EXACT when not provided', async () => {
    mockCreatePlace.mockResolvedValue({
      id: 'place-1',
      name: 'Service Test Peak',
      slug: 'service-test-peak',
      category: 'TREK',
      shortDescription: null,
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
    });

    await placeService.createPlace(validInput);

    expect(mockCreatePlace).toHaveBeenCalledWith(
      expect.objectContaining({ visibilityLevel: 'PUBLIC_EXACT' })
    );
  });

  it('preserves explicitly provided optional fields', async () => {
    mockCreatePlace.mockResolvedValue({
      id: 'place-1',
      name: 'Service Test Peak',
      slug: 'service-test-peak',
      category: 'TREK',
      shortDescription: 'A test peak',
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
    });

    const fullInput = {
      ...validInput,
      shortDescription: 'A test peak',
      difficulty: 3,
      status: 'OPEN' as const,
      trustLevel: 'VERIFIED' as const,
      trustScore: 95,
      hasParking: true,
      hasWater: true,
      hasNetwork: true,
      permitRequired: true,
      trailDistanceKm: 5,
    };

    await placeService.createPlace(fullInput);

    // The service passes the full validated input to the repository
    expect(mockCreatePlace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Service Test Peak',
        category: 'TREK',
        latitude: 13.0,
        longitude: 77.5,
        shortDescription: 'A test peak',
        difficulty: 3,
        status: 'OPEN',
        permitRequired: true,
        trailDistanceKm: 5,
      })
    );
  });
});

describe('placeCreateSchema validation', () => {
  it('accepts minimal valid input', () => {
    const input = {
      name: 'Minimal Place',
      category: 'TREK',
      latitude: 13.0,
      longitude: 77.5,
    };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const input = { category: 'TREK', latitude: 13.0, longitude: 77.5 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing category', () => {
    const input = { name: 'Test', latitude: 13.0, longitude: 77.5 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing latitude', () => {
    const input = { name: 'Test', category: 'TREK', longitude: 77.5 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing longitude', () => {
    const input = { name: 'Test', category: 'TREK', latitude: 13.0 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects latitude out of range', () => {
    const input = { name: 'Test', category: 'TREK', latitude: 100, longitude: 77.5 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects longitude out of range', () => {
    const input = { name: 'Test', category: 'TREK', latitude: 13.0, longitude: 200 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid category enum', () => {
    const input = { name: 'Test', category: 'INVALID', latitude: 13.0, longitude: 77.5 };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts all valid category enums', () => {
    const categories = ['TREK', 'HIKE', 'WATERFALL', 'LAKE', 'MOUNTAIN', 'FOREST', 'CAVE', 'FORT', 'VIEWPOINT', 'CAMPING', 'CYCLING', 'SCENIC_DRIVE', 'HIDDEN_GEM'];
    for (const cat of categories) {
      const result = placeCreateSchema.safeParse({ name: 'Test', category: cat, latitude: 13.0, longitude: 77.5 });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional slug', () => {
    const result = placeCreateSchema.safeParse({ name: 'Test', category: 'TREK', latitude: 13.0, longitude: 77.5, slug: 'custom-slug' });
    expect(result.success).toBe(true);
  });

  it('rejects slug with invalid format', () => {
    // Slug must be lowercase alphanumeric with hyphens only
    const result = placeCreateSchema.safeParse({
      name: 'Test',
      category: 'TREK',
      latitude: 13.0,
      longitude: 77.5,
      slug: 'invalid slug!', // space and ! not allowed
    });
    expect(result.success).toBe(false);
  });

  it('accepts all optional fields', () => {
    const input = {
      name: 'Full Place',
      category: 'TREK',
      latitude: 13.0,
      longitude: 77.5,
      description: 'Description',
      shortDescription: 'Short desc',
      subcategory: 'Mountain',
      region: 'Region',
      locality: 'Locality',
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
      permitDetails: 'Permit needed',
      permitUrl: 'https://example.com/permit',
      hasParking: true,
      parkingDetails: 'Parking',
      hasWater: true,
      waterDetails: 'Water',
      hasNetwork: true,
      networkDetails: 'Network',
      crowdLevel: 2,
      bestSeasonStart: 10,
      bestSeasonEnd: 3,
      status: 'OPEN',
      trustScore: 95,
      trustLevel: 'VERIFIED',
      visibilityLevel: 'PUBLIC_EXACT',
      sourceReferences: [{ type: 'official', title: 'Source' }],
    };
    const result = placeCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});