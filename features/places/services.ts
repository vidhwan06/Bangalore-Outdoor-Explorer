// Place service - Business logic layer for Place operations
// Uses repository for data access

import {
  findNearbyPlaces,
  findPlacesInBounds,
  findPlaceById,
  findPlaceBySlug,
  type NearbyPlaceParams,
  type BoundsParams,
  type PaginatedResult,
  type PlaceResult,
  type PlaceDetailResult,
} from './repositories';

export interface NearbySearchInput {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  limit?: number;
  offset?: number;
  category?: string;
  status?: string;
  difficulty?: number;
}

export interface BoundsSearchInput {
  north: number;
  south: number;
  east: number;
  west: number;
  limit?: number;
  offset?: number;
  category?: string;
  status?: string;
  difficulty?: number;
}

export interface NearbySearchOutput {
  data: PlaceResult[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
    hasMore: boolean;
  };
}

/**
 * Service for searching nearby places
 * Validates input, applies sensible defaults and limits
 */
export const placeService = {
  /**
   * Search for places within a radius of a given point
   * Maximum radius: 50,000 meters (50km) to prevent abusive queries
   * Maximum limit: 100 to prevent excessive data transfer
   */
  async searchNearby(input: NearbySearchInput): Promise<NearbySearchOutput> {
    const MAX_RADIUS_METERS = 50000; // 50km max
    const MAX_LIMIT = 100;
    const DEFAULT_LIMIT = 20;
    const DEFAULT_OFFSET = 0;

    // Apply defaults and clamp values
    const radiusMeters = Math.min(Math.max(0, input.radiusMeters), MAX_RADIUS_METERS);
    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const offset = Math.max(0, input.offset ?? DEFAULT_OFFSET);

    const params: NearbyPlaceParams = {
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters,
      limit,
      offset,
      category: input.category as any,
      status: input.status as any,
      difficulty: input.difficulty,
    };

    const result = await findNearbyPlaces(params);
    return result;
  },

  /**
   * Search for places within a map viewport (bounding box)
   * Maximum limit: 200 for map viewport queries
   */
  async searchInBounds(input: BoundsSearchInput): Promise<NearbySearchOutput> {
    const MAX_LIMIT = 200;
    const DEFAULT_LIMIT = 50;
    const DEFAULT_OFFSET = 0;

    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const offset = Math.max(0, input.offset ?? DEFAULT_OFFSET);

    const params: BoundsParams = {
      north: input.north,
      south: input.south,
      east: input.east,
      west: input.west,
      limit,
      offset,
      category: input.category as any,
      status: input.status as any,
      difficulty: input.difficulty,
    };

    const result = await findPlacesInBounds(params);
    return result;
  },

  /**
   * Get a single place by ID
   */
  async getById(id: string): Promise<PlaceResult | null> {
    return findPlaceById(id);
  },

  /**
   * Get a single place by slug (detail shape: description + sources)
   */
  async getBySlug(slug: string): Promise<PlaceDetailResult | null> {
    return findPlaceBySlug(slug);
  },
};
