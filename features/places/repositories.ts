// Place repository - Data access layer for Place model
// Handles database queries with PostGIS spatial functions

import { prisma } from '@/lib/db/prisma';
import {
  getDistanceSQL,
  getWithinRadiusSQL,
  getWithinBoundsSQL,
  getLatitudeSQL,
  getLongitudeSQL,
} from '@/lib/db/postgis';
import type { place_category, place_status } from '@prisma/client';

export interface NearbyPlaceParams {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  limit: number;
  offset: number;
  category?: place_category;
  status?: place_status;
  difficulty?: number;
}

export interface BoundsParams {
  north: number;
  south: number;
  east: number;
  west: number;
  limit: number;
  offset: number;
  category?: place_category;
  status?: place_status;
  difficulty?: number;
}

export interface PlaceResult {
  id: string;
  name: string;
  slug: string;
  category: place_category;
  shortDescription: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  difficulty: number | null;
  status: place_status;
  trustLevel: string;
  visibilityLevel: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
    hasMore: boolean;
  };
}

/** Official/verified source attached to a place (OfficialSource table). */
export interface PlaceSourceResult {
  id: string;
  name: string;
  type: string;
  url: string | null;
}

/**
 * Richer shape for single-place lookups (place details).
 * Extends the shared PlaceResult with detail-only fields — the nearby
 * endpoint and its response contract are unaffected.
 */
export interface PlaceDetailResult extends PlaceResult {
  description: string | null;
  sources: PlaceSourceResult[];
}

/**
 * Builds the WHERE clause for optional filters
 * Exported for testing purposes
 */
export function buildFilterWhere(
  category?: place_category,
  status?: place_status,
  difficulty?: number
): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (category) {
    conditions.push(`category = $${paramIndex}::place_category`);
    params.push(category);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}::place_status`);
    params.push(status);
    paramIndex++;
  }

  if (difficulty !== undefined) {
    conditions.push(`difficulty = $${paramIndex}`);
    params.push(difficulty);
    paramIndex++;
  }

  // Only return places appropriate for public discovery
  // Exclude places with visibilityLevel that restricts public access
  conditions.push(`"visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')`);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where: whereClause, params };
}

/**
 * Finds places within a radius of a given point
 * Uses PostGIS ST_DWithin for efficient spatial index usage
 * Calculates distance using ST_Distance
 * Orders by distance ascending
 */
export async function findNearbyPlaces(
  params: NearbyPlaceParams
): Promise<PaginatedResult<PlaceResult>> {
  const { latitude, longitude, radiusMeters, limit, offset, category, status, difficulty } = params;

  const { where, params: filterParams } = buildFilterWhere(category, status, difficulty);

  const distanceSQL = getDistanceSQL(longitude, latitude);
  const withinRadiusSQL = getWithinRadiusSQL(longitude, latitude, radiusMeters);

  // Build the full query with parameterized values
  // We need to inject the spatial SQL fragments but keep user values parameterized
  const query = `
    SELECT
      id,
      name,
      slug,
      category,
      "shortDescription",
      ${getLatitudeSQL()} as latitude,
      ${getLongitudeSQL()} as longitude,
      ${distanceSQL} as "distanceMeters",
      difficulty,
      status,
      "trustLevel",
      "visibilityLevel"
    FROM "Place"
    ${where}
      AND ${withinRadiusSQL}
    ORDER BY "distanceMeters" ASC
    LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "Place"
    ${where}
      AND ${withinRadiusSQL}
  `;

  const queryParams = [...filterParams, limit, offset];
  const countParams = [...filterParams];

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<PlaceResult[]>(query, ...queryParams),
    prisma.$queryRawUnsafe<{ total: bigint }[]>(countQuery, ...countParams),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data: rows.map((row) => ({
      ...row,
      distanceMeters: Number(row.distanceMeters),
    })),
    pagination: {
      limit,
      offset,
      count: total,
      hasMore: offset + limit < total,
    },
  };
}

/**
 * Finds places within a bounding box (map viewport)
 * Uses PostGIS envelope intersection for efficient spatial index usage
 */
export async function findPlacesInBounds(
  params: BoundsParams
): Promise<PaginatedResult<PlaceResult>> {
  const { north, south, east, west, limit, offset, category, status, difficulty } = params;

  const { where, params: filterParams } = buildFilterWhere(category, status, difficulty);
  const withinBoundsSQL = getWithinBoundsSQL(west, south, east, north);

  const query = `
    SELECT
      id,
      name,
      slug,
      category,
      "shortDescription",
      ${getLatitudeSQL()} as latitude,
      ${getLongitudeSQL()} as longitude,
      0 as "distanceMeters",
      difficulty,
      status,
      "trustLevel",
      "visibilityLevel"
    FROM "Place"
    ${where}
      AND ${withinBoundsSQL}
    ORDER BY name ASC
    LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "Place"
    ${where}
      AND ${withinBoundsSQL}
  `;

  const queryParams = [...filterParams, limit, offset];
  const countParams = [...filterParams];

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<PlaceResult[]>(query, ...queryParams),
    prisma.$queryRawUnsafe<{ total: bigint }[]>(countQuery, ...countParams),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data: rows,
    pagination: {
      limit,
      offset,
      count: total,
      hasMore: offset + limit < total,
    },
  };
}

/**
 * Gets a single place by ID with coordinates
 */
export async function findPlaceById(id: string): Promise<PlaceResult | null> {
  const query = `
    SELECT
      id,
      name,
      slug,
      category,
      "shortDescription",
      ${getLatitudeSQL()} as latitude,
      ${getLongitudeSQL()} as longitude,
      0 as "distanceMeters",
      difficulty,
      status,
      "trustLevel",
      "visibilityLevel"
    FROM "Place"
    WHERE id = $1
      AND "visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')
  `;

  const rows = await prisma.$queryRawUnsafe<PlaceResult[]>(query, id);
  return rows[0] ?? null;
}

/**
 * Gets a single place by slug with coordinates, description and sources.
 * Non-public visibility levels are excluded, same as every other lookup.
 */
export async function findPlaceBySlug(slug: string): Promise<PlaceDetailResult | null> {
  const query = `
    SELECT
      id,
      name,
      slug,
      category,
      "shortDescription",
      description,
      ${getLatitudeSQL()} as latitude,
      ${getLongitudeSQL()} as longitude,
      0 as "distanceMeters",
      difficulty,
      status,
      "trustLevel",
      "visibilityLevel"
    FROM "Place"
    WHERE slug = $1
      AND "visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')
  `;

  type PlaceDetailRow = PlaceResult & { description: string | null };

  const rows = await prisma.$queryRawUnsafe<PlaceDetailRow[]>(query, slug);
  const place = rows[0] ?? null;
  if (!place) return null;

  // Typed Prisma query (non-spatial) — no raw SQL needed for sources
  const sources = await prisma.officialSource.findMany({
    where: { placeId: place.id },
    select: { id: true, name: true, type: true, url: true },
    orderBy: { name: 'asc' },
  });

  return { ...place, sources };
}
