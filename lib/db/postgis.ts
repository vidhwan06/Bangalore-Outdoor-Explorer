// PostGIS location utility
// Provides reusable helpers for working with Place.location geography points
// Prisma maps Place.location as Unsupported("geography(Point, 4326)"),
// so normal Prisma CRUD does NOT write to this column.
// Future repository/service code should use Prisma create/update followed by
// this helper to set the authoritative spatial coordinate.

import { prisma } from '@/lib/db/prisma';

/**
 * Validates latitude and longitude ranges
 * Latitude: -90 to 90
 * Longitude: -180 to 180
 */
export function validateCoordinates(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
  }
}

/**
 * Creates a PostGIS geography point from latitude/longitude
 * IMPORTANT: PostGIS uses POINT(longitude, latitude) - longitude first!
 * SQL: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
 */
export function createGeographyPoint(longitude: number, latitude: number): string {
  validateCoordinates(latitude, longitude);
  return `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
}

/**
 * Sets the location for a place using raw SQL
 * Uses parameterized query to prevent SQL injection
 */
export async function setPlaceLocation(
  slug: string,
  longitude: number,
  latitude: number
): Promise<void> {
  validateCoordinates(latitude, longitude);
  await prisma.$executeRawUnsafe(
    `UPDATE "Place" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE slug = $3`,
    longitude,
    latitude,
    slug
  );
}

/**
 * Extracts latitude from a geography point
 * SQL: ST_Y(location::geometry)
 */
export function getLatitudeSQL(): string {
  return 'ST_Y(location::geometry)';
}

/**
 * Extracts longitude from a geography point
 * SQL: ST_X(location::geometry)
 */
export function getLongitudeSQL(): string {
  return 'ST_X(location::geometry)';
}

/**
 * Calculates distance between a place location and a reference point in meters
 * SQL: ST_Distance(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography)
 */
export function getDistanceSQL(longitude: number, latitude: number): string {
  validateCoordinates(latitude, longitude);
  return `ST_Distance(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)`;
}

/**
 * Checks if a place location is within a radius of a reference point
 * SQL: ST_DWithin(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radiusMeters)
 */
export function getWithinRadiusSQL(longitude: number, latitude: number, radiusMeters: number): string {
  validateCoordinates(latitude, longitude);
  if (radiusMeters < 0) {
    throw new Error(`Invalid radius: ${radiusMeters}. Must be non-negative.`);
  }
  return `ST_DWithin(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})`;
}

/**
 * Checks if a place location is within a bounding box
 * SQL: location && ST_MakeEnvelope(west, south, east, north, 4326)::geography
 * Note: For geography, we use the envelope as geometry for the && operator
 */
export function getWithinBoundsSQL(west: number, south: number, east: number, north: number): string {
  validateCoordinates(south, west);
  validateCoordinates(north, east);
  if (north <= south) {
    throw new Error(`Invalid bounds: north (${north}) must be > south (${south})`);
  }
  if (east <= west) {
    throw new Error(`Invalid bounds: east (${east}) must be > west (${west})`);
  }
  return `location && ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)::geography`;
}