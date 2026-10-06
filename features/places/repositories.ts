// Place repository - Data access layer for Place model
// Handles database queries with PostGIS spatial functions

import { prisma } from '@/lib/db/prisma';
import {
  getDistanceSQL,
  getWithinRadiusSQL,
  getWithinBoundsSQL,
  getLatitudeSQL,
  getLongitudeSQL,
  setPlaceLocation,
} from '@/lib/db/postgis';
import {
  PRIMARY_PHOTO_SELECT_ITEM,
  findPhotosForPlace,
  primaryPhotoLateralSQL,
  type PlacePhotoResult,
} from '@/features/places/photos';
import type { place_category, place_status, trust_level, visibility_level } from '@prisma/client';
import { slugify } from '@/lib/utils';

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
  trustLevel: trust_level;
  visibilityLevel: visibility_level;
  trustScore: number;
  hasParking: boolean;
  hasWater: boolean;
  hasNetwork: boolean;
  permitRequired: boolean;
  trailDistanceKm: number | null;
  /**
   * URL of the place's primary photo, derived from PlacePhoto at query time.
   * NULL when the place has no photos. Never stored on the Place row.
   */
  primaryPhotoUrl: string | null;
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
  /**
   * All photos for the place in primary-first order, including provenance and
   * alt text. Empty when the place has no photos.
   */
  photos: PlacePhotoResult[];
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
  // We need to inject the spatial SQL fragments but keep user values parameterized.
  // The primary photo is resolved by a LATERAL join in the same statement, so
  // the whole page costs one query instead of one query per place.
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
      "visibilityLevel",
      "trustScore",
      "hasParking",
      "hasWater",
      "hasNetwork",
      "permitRequired",
      "trailDistanceKm",
      ${PRIMARY_PHOTO_SELECT_ITEM}
    FROM "Place" p
    ${primaryPhotoLateralSQL('p')}
    ${where}
      AND ${withinRadiusSQL}
    ORDER BY "distanceMeters" ASC, p.id ASC
    LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "Place" p
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
      "visibilityLevel",
      "trustScore",
      "hasParking",
      "hasWater",
      "hasNetwork",
      "permitRequired",
      "trailDistanceKm",
      ${PRIMARY_PHOTO_SELECT_ITEM}
    FROM "Place" p
    ${primaryPhotoLateralSQL('p')}
    ${where}
      AND ${withinBoundsSQL}
    ORDER BY name ASC, p.id ASC
    LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "Place" p
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
      "visibilityLevel",
      "trustScore",
      "hasParking",
      "hasWater",
      "hasNetwork",
      "permitRequired",
      "trailDistanceKm",
      ${PRIMARY_PHOTO_SELECT_ITEM}
    FROM "Place" p
    ${primaryPhotoLateralSQL('p')}
    WHERE p.id = $1
      AND p."visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')
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
      "visibilityLevel",
      "trustScore",
      "hasParking",
      "hasWater",
      "hasNetwork",
      "permitRequired",
      "trailDistanceKm",
      ${PRIMARY_PHOTO_SELECT_ITEM}
    FROM "Place" p
    ${primaryPhotoLateralSQL('p')}
    WHERE p.slug = $1
      AND p."visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')
  `;

  type PlaceDetailRow = PlaceResult & { description: string | null };

  const rows = await prisma.$queryRawUnsafe<PlaceDetailRow[]>(query, slug);
  const place = rows[0] ?? null;
  if (!place) return null;

  // Typed Prisma query (non-spatial) — no raw SQL needed for relations.
  // Sources and photos are both 1-to-many reads of a single place, so running
  // them together costs two statements regardless of how many rows each has.
  const [sources, photos] = await Promise.all([
    prisma.officialSource.findMany({
      where: { placeId: place.id },
      select: { id: true, name: true, type: true, url: true },
      orderBy: { name: 'asc' },
    }),
    findPhotosForPlace(place.id),
  ]);

  return { ...place, sources, photos };
}

/**
 * Gets count of places per category for public discovery
 * Only includes places with public visibility levels
 */
export async function getCategoryCounts(): Promise<Record<place_category, number>> {
  const query = `
    SELECT category, COUNT(*) as count
    FROM "Place"
    WHERE "visibilityLevel" IN ('PUBLIC_EXACT', 'PUBLIC_APPROXIMATE')
    GROUP BY category
  `;

  const rows = await prisma.$queryRawUnsafe<{ category: place_category; count: bigint }[]>(query);

  const counts: Record<place_category, number> = {
    TREK: 0,
    HIKE: 0,
    WATERFALL: 0,
    LAKE: 0,
    MOUNTAIN: 0,
    FOREST: 0,
    CAVE: 0,
    FORT: 0,
    VIEWPOINT: 0,
    CAMPING: 0,
    CYCLING: 0,
    SCENIC_DRIVE: 0,
    HIDDEN_GEM: 0,
  };

  for (const row of rows) {
    counts[row.category] = Number(row.count);
  }

  return counts;
}

/**
 * Creates a new place with PostGIS location.
 * Uses the two-step pattern: Prisma create + raw SQL for geography point.
 * Handles slug generation and collision resolution.
 */
export interface CreatePlaceInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  category: place_category;
  subcategory?: string | null;
  latitude: number;
  longitude: number;
  region?: string | null;
  locality?: string | null;
  difficulty?: number | null;
  trailDistanceKm?: number | null;
  durationHours?: number | null;
  elevationM?: number | null;
  elevationGainM?: number | null;
  openingTime?: string | null;
  closingTime?: string | null;
  lastEntryTime?: string | null;
  entryFeeInr?: number | null;
  permitRequired?: boolean | null;
  permitDetails?: string | null;
  permitUrl?: string | null;
  hasParking?: boolean | null;
  parkingDetails?: string | null;
  hasWater?: boolean | null;
  waterDetails?: string | null;
  hasNetwork?: boolean | null;
  networkDetails?: string | null;
  crowdLevel?: number | null;
  bestSeasonStart?: number | null;
  bestSeasonEnd?: number | null;
  status?: place_status;
  trustScore?: number | null;
  trustLevel?: trust_level;
  visibilityLevel?: visibility_level;
  sourceReferences?: unknown;
  createdById?: string | null;
}

/**
 * Resolves a unique slug by checking for collisions and appending a suffix if needed.
 * Returns the resolved slug.
 */
export async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.place.findUnique({ where: { slug } });
    if (!existing) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

/**
 * PostgreSQL columns that require explicit JSON casting in raw SQL.
 */
const JSON_COLUMNS = new Set<string>([
  'sourceReferences',
]);

/**
 * PostgreSQL enum column names that require explicit casting in raw SQL.
 * Maps column names to their PostgreSQL enum type names.
 */
const ENUM_COLUMN_TYPES: Record<string, string> = {
  category: 'place_category',
  status: 'place_status',
  trustLevel: 'trust_level',
  visibilityLevel: 'visibility_level',
};

/**
 * Creates a new place with the given input.
 * Uses raw SQL insert because Place has Unsupported geography field.
 * Returns the created place with coordinates in PlaceResult shape.
 */
export async function createPlace(input: CreatePlaceInput): Promise<PlaceResult> {
  const { latitude, longitude, slug: providedSlug, createdById, ...rest } = input;

  // Generate slug from name if not provided
  const baseSlug = providedSlug ?? slugify(input.name);
  const slug = await resolveUniqueSlug(baseSlug);

  // Build the insert query dynamically based on provided fields
  // The location is set to a temporary point, then updated with the real coordinates
  // We use ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography as placeholder
  // and then update it with the real coordinates via setPlaceLocation

  const columns = ['id', 'slug', 'name'];
  const values = ['gen_random_uuid()::text', `$1`, `$2`];
  const params: unknown[] = [slug, input.name];
  let paramIndex = 3;

  // Add optional fields that are provided
  const optionalFields: Array<{ key: string; value: unknown; col: string }> = [
    { key: 'description', value: rest.description, col: 'description' },
    { key: 'shortDescription', value: rest.shortDescription, col: 'shortDescription' },
    { key: 'category', value: rest.category, col: 'category' },
    { key: 'subcategory', value: rest.subcategory, col: 'subcategory' },
    { key: 'region', value: rest.region, col: 'region' },
    { key: 'locality', value: rest.locality, col: 'locality' },
    { key: 'difficulty', value: rest.difficulty, col: 'difficulty' },
    { key: 'trailDistanceKm', value: rest.trailDistanceKm, col: 'trailDistanceKm' },
    { key: 'durationHours', value: rest.durationHours, col: 'durationHours' },
    { key: 'elevationM', value: rest.elevationM, col: 'elevationM' },
    { key: 'elevationGainM', value: rest.elevationGainM, col: 'elevationGainM' },
    { key: 'openingTime', value: rest.openingTime, col: 'openingTime' },
    { key: 'closingTime', value: rest.closingTime, col: 'closingTime' },
    { key: 'lastEntryTime', value: rest.lastEntryTime, col: 'lastEntryTime' },
    { key: 'entryFeeInr', value: rest.entryFeeInr, col: 'entryFeeInr' },
    { key: 'permitRequired', value: rest.permitRequired, col: 'permitRequired' },
    { key: 'permitDetails', value: rest.permitDetails, col: 'permitDetails' },
    { key: 'permitUrl', value: rest.permitUrl, col: 'permitUrl' },
    { key: 'hasParking', value: rest.hasParking, col: 'hasParking' },
    { key: 'parkingDetails', value: rest.parkingDetails, col: 'parkingDetails' },
    { key: 'hasWater', value: rest.hasWater, col: 'hasWater' },
    { key: 'waterDetails', value: rest.waterDetails, col: 'waterDetails' },
    { key: 'hasNetwork', value: rest.hasNetwork, col: 'hasNetwork' },
    { key: 'networkDetails', value: rest.networkDetails, col: 'networkDetails' },
    { key: 'crowdLevel', value: rest.crowdLevel, col: 'crowdLevel' },
    { key: 'bestSeasonStart', value: rest.bestSeasonStart, col: 'bestSeasonStart' },
    { key: 'bestSeasonEnd', value: rest.bestSeasonEnd, col: 'bestSeasonEnd' },
    { key: 'status', value: rest.status, col: 'status' },
    { key: 'trustScore', value: rest.trustScore, col: 'trustScore' },
    { key: 'trustLevel', value: rest.trustLevel, col: 'trustLevel' },
    { key: 'visibilityLevel', value: rest.visibilityLevel, col: 'visibilityLevel' },
    { key: 'sourceReferences', value: rest.sourceReferences, col: 'sourceReferences' },
    { key: 'createdById', value: createdById, col: 'createdById' },
  ];

  for (const field of optionalFields) {
    // Skip null values to allow database defaults to apply for NOT NULL columns
    if (field.value === undefined || field.value === null) {
      continue;
    }
    columns.push(`"${field.col}"`);
    // Cast enum columns explicitly in the VALUES clause
    let valuePlaceholder: string;
    if (JSON_COLUMNS.has(field.col)) {
      valuePlaceholder = `$${paramIndex}::jsonb`;
    } else if (ENUM_COLUMN_TYPES[field.col]) {
      valuePlaceholder = `$${paramIndex}::${ENUM_COLUMN_TYPES[field.col]}`;
    } else {
      valuePlaceholder = `$${paramIndex}`;
    }
    values.push(valuePlaceholder);
    // Serialize JSON columns to JSON strings before passing as parameters
    const paramValue = JSON_COLUMNS.has(field.col)
      ? JSON.stringify(field.value)
      : field.value;
    params.push(paramValue);
    paramIndex++;
  }

  // Add default values for fields not provided but required by DB
  // location uses a placeholder, then updated
  columns.push('location');
  values.push('ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography');

  const insertQuery = `
    INSERT INTO "Place" (${columns.join(', ')})
    VALUES (${values.join(', ')})
    RETURNING id
  `;

  const result = await prisma.$queryRawUnsafe<{ id: string }[]>(insertQuery, ...params);
  const placeId = result[0]?.id;
  if (!placeId) {
    throw new Error('Failed to insert place');
  }

  // Step 2: Set PostGIS geography point
  await setPlaceLocation(slug, longitude, latitude);

  // Step 3: Fetch the created place with coordinates for return
  const created = await findPlaceById(placeId);
  if (!created) {
    throw new Error(`Failed to retrieve created place with id ${placeId}`);
  }
  return created;
}

/**
 * Upserts a place by slug: inserts if not exists, updates if exists.
 * Returns the place with coordinates and a flag indicating whether it was created or updated.
 */
export async function upsertPlace(input: CreatePlaceInput): Promise<{ place: PlaceResult; created: boolean }> {
  const { latitude, longitude, slug: providedSlug, createdById, ...rest } = input;

  // Generate slug from name if not provided
  const baseSlug = providedSlug ?? slugify(input.name);
  
  // Check if place with this slug already exists
  const existing = await prisma.place.findUnique({ where: { slug: baseSlug } });

  if (existing) {
    // Update existing place
    const slug = baseSlug;
    
    // Build the update query dynamically based on provided fields
    const updateFields: Array<{ key: string; value: unknown; col: string }> = [
      { key: 'name', value: input.name, col: 'name' },
      { key: 'description', value: rest.description, col: 'description' },
      { key: 'shortDescription', value: rest.shortDescription, col: 'shortDescription' },
      { key: 'category', value: rest.category, col: 'category' },
      { key: 'subcategory', value: rest.subcategory, col: 'subcategory' },
      { key: 'region', value: rest.region, col: 'region' },
      { key: 'locality', value: rest.locality, col: 'locality' },
      { key: 'difficulty', value: rest.difficulty, col: 'difficulty' },
      { key: 'trailDistanceKm', value: rest.trailDistanceKm, col: 'trailDistanceKm' },
      { key: 'durationHours', value: rest.durationHours, col: 'durationHours' },
      { key: 'elevationM', value: rest.elevationM, col: 'elevationM' },
      { key: 'elevationGainM', value: rest.elevationGainM, col: 'elevationGainM' },
      { key: 'openingTime', value: rest.openingTime, col: 'openingTime' },
      { key: 'closingTime', value: rest.closingTime, col: 'closingTime' },
      { key: 'lastEntryTime', value: rest.lastEntryTime, col: 'lastEntryTime' },
      { key: 'entryFeeInr', value: rest.entryFeeInr, col: 'entryFeeInr' },
      { key: 'permitRequired', value: rest.permitRequired, col: 'permitRequired' },
      { key: 'permitDetails', value: rest.permitDetails, col: 'permitDetails' },
      { key: 'permitUrl', value: rest.permitUrl, col: 'permitUrl' },
      { key: 'hasParking', value: rest.hasParking, col: 'hasParking' },
      { key: 'parkingDetails', value: rest.parkingDetails, col: 'parkingDetails' },
      { key: 'hasWater', value: rest.hasWater, col: 'hasWater' },
      { key: 'waterDetails', value: rest.waterDetails, col: 'waterDetails' },
      { key: 'hasNetwork', value: rest.hasNetwork, col: 'hasNetwork' },
      { key: 'networkDetails', value: rest.networkDetails, col: 'networkDetails' },
      { key: 'crowdLevel', value: rest.crowdLevel, col: 'crowdLevel' },
      { key: 'bestSeasonStart', value: rest.bestSeasonStart, col: 'bestSeasonStart' },
      { key: 'bestSeasonEnd', value: rest.bestSeasonEnd, col: 'bestSeasonEnd' },
      { key: 'status', value: rest.status, col: 'status' },
      { key: 'trustScore', value: rest.trustScore, col: 'trustScore' },
      { key: 'trustLevel', value: rest.trustLevel, col: 'trustLevel' },
      { key: 'visibilityLevel', value: rest.visibilityLevel, col: 'visibilityLevel' },
      { key: 'sourceReferences', value: rest.sourceReferences, col: 'sourceReferences' },
      { key: 'createdById', value: createdById, col: 'createdById' },
    ];

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const field of updateFields) {
      // Skip null values so database defaults are never overwritten with NULL
      if (field.value === undefined || field.value === null) {
        continue;
      }
      // Cast enum columns explicitly in the SET clause
      let valuePlaceholder: string;
      if (JSON_COLUMNS.has(field.col)) {
        valuePlaceholder = `$${paramIndex}::jsonb`;
      } else if (ENUM_COLUMN_TYPES[field.col]) {
        valuePlaceholder = `$${paramIndex}::${ENUM_COLUMN_TYPES[field.col]}`;
      } else {
        valuePlaceholder = `$${paramIndex}`;
      }
      setClauses.push(`"${field.col}" = ${valuePlaceholder}`);
      // Serialize JSON columns to JSON strings before passing as parameters
      const paramValue = JSON_COLUMNS.has(field.col)
        ? JSON.stringify(field.value)
        : field.value;
      params.push(paramValue);
      paramIndex++;
    }

    // Always update location with new coordinates
    setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
    params.push(longitude, latitude);
    paramIndex += 2;

    // Always update updatedAt
    setClauses.push(`"updatedAt" = NOW()`);

    if (setClauses.length > 0) {
      const updateQuery = `
        UPDATE "Place"
        SET ${setClauses.join(', ')}
        WHERE slug = $${paramIndex}
      `;
      params.push(baseSlug);
      
      await prisma.$queryRawUnsafe(updateQuery, ...params);
    }

    // Update the PostGIS location
    await setPlaceLocation(baseSlug, longitude, latitude);

    // Fetch the updated place with coordinates
    const updated = await findPlaceById(existing.id);
    if (!updated) {
      throw new Error(`Failed to retrieve updated place with id ${existing.id}`);
    }
    return { place: updated, created: false };
  } else {
    // Insert new place (reuse createPlace logic)
    const place = await createPlace(input);
    return { place, created: true };
  }
}
