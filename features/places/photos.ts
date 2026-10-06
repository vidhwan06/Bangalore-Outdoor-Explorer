// Place photo repository - Data access layer for the PlacePhoto model.
//
// Single source of truth for place imagery: photos are always read from
// PlacePhoto and never denormalised onto the Place table.
//
// PlacePhoto has no PostGIS `location` column, so every query here uses the
// typed Prisma client rather than raw SQL. The only raw SQL in this feature is
// the LATERAL fragment below, which resolves the primary photo for a set of
// places in the same statement as the spatial query (see repositories.ts) to
// avoid an N+1.

import { prisma } from '@/lib/db/prisma';
import { placePhotoSchema, type PlacePhoto } from '@/lib/validation/schemas';

/** A validated place photo, as returned to callers. */
export type PlacePhotoResult = PlacePhoto;

/**
 * A raw PlacePhoto row as it comes back from Prisma.
 * `license` is `string` on the model but is narrowed to the enum by
 * {@link placePhotoSchema}, which is exactly what the read path validates.
 */
interface PlacePhotoRow {
  id: string;
  placeId: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  license: string;
  attribution: string;
  altText: string;
  sourceUrl: string | null;
  photographerName: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

/**
 * Deterministic photo ordering, used by every read path.
 *
 * Mirrors the composite index idx_place_photo_primary_order and guarantees a
 * stable, total order:
 *   1. primary photos first
 *   2. then the editor's explicit sortOrder
 *   3. then insertion time, so photos with an equal sortOrder never swap places
 *      between identical queries
 */
export const PHOTO_ORDER_BY = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
] as const;

/** Columns a photo row exposes. `createdAt` and `photographerId` stay internal. */
const PHOTO_SELECT = {
  id: true,
  placeId: true,
  url: true,
  thumbnailUrl: true,
  caption: true,
  license: true,
  attribution: true,
  altText: true,
  sourceUrl: true,
  photographerName: true,
  isPrimary: true,
  sortOrder: true,
} as const;

/** The same ordering expressed in SQL, for the LATERAL primary-photo lookup. */
export const PHOTO_ORDER_BY_SQL = '"isPrimary" DESC, "sortOrder" ASC, "createdAt" ASC';

/** Alias for the LATERAL subquery. `PRIMARY` is a reserved word, so avoid it. */
const PHOTO_ALIAS = 'pp';

/**
 * SELECT item that surfaces the primary photo URL as `primaryPhotoUrl`.
 * Pairs with {@link primaryPhotoLateralSQL}.
 */
export const PRIMARY_PHOTO_SELECT_ITEM = `${PHOTO_ALIAS}.url AS "primaryPhotoUrl"`;

/**
 * LEFT JOIN LATERAL fragment that resolves one place's primary photo in the
 * same statement. Returns NULL for a place with no photos.
 *
 * @param placeAlias alias of the Place relation in the enclosing query.
 */
export function primaryPhotoLateralSQL(placeAlias = 'p'): string {
  return `
    LEFT JOIN LATERAL (
      SELECT url
      FROM "PlacePhoto" photo
      WHERE photo."placeId" = ${placeAlias}.id
      ORDER BY ${PHOTO_ORDER_BY_SQL}
      LIMIT 1
    ) ${PHOTO_ALIAS} ON TRUE`;
}

function toPhotoResult(row: PlacePhotoRow): PlacePhotoResult {
  const parsed = placePhotoSchema.safeParse(row);
  if (!parsed.success) {
    // A row that fails validation violates a database CHECK constraint and
    // should never exist. Fail loudly rather than silently dropping imagery.
    throw new Error(
      `PlacePhoto ${row.id} failed validation: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`
    );
  }
  return parsed.data;
}

/**
 * All photos for a place, in {@link PHOTO_ORDER_BY} order.
 * Returns an empty array when the place has no photos.
 */
export async function findPhotosForPlace(placeId: string): Promise<PlacePhotoResult[]> {
  const rows = await prisma.placePhoto.findMany({
    where: { placeId },
    select: PHOTO_SELECT,
    orderBy: [...PHOTO_ORDER_BY],
  });
  return rows.map(toPhotoResult);
}

/**
 * URL of a place's primary photo, or null when the place has no photos.
 *
 * Uses the same deterministic ordering as {@link findPhotosForPlace}. Intended
 * for single-place lookups; for lists use the LATERAL fragment so that many
 * places are resolved in one statement.
 */
export async function findPrimaryPhotoUrl(placeId: string): Promise<string | null> {
  const row = await prisma.placePhoto.findFirst({
    where: { placeId },
    select: { url: true },
    orderBy: [...PHOTO_ORDER_BY],
  });
  return row?.url ?? null;
}

/**
 * Primary photo URLs for many places, resolved in a single typed query.
 *
 * Provided for callers outside the spatial query path (for example a future
 * detail listing). Prefer the LATERAL fragment when the places are already
 * being selected — this helper exists so a batch is never a per-place loop.
 */
export async function findPrimaryPhotoUrls(placeIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(placeIds)];
  if (unique.length === 0) return new Map();

  // findMany + in-memory reduction keeps this to one round trip. Prisma cannot
  // express "first row per group" without a raw query, and a raw query here
  // would duplicate the ordering contract that PHOTO_ORDER_BY already owns.
  const rows = await prisma.placePhoto.findMany({
    where: { placeId: { in: unique } },
    select: { placeId: true, url: true },
    orderBy: [...PHOTO_ORDER_BY],
  });

  const firstPerPlace = new Map<string, string>();
  for (const row of rows) {
    if (!firstPerPlace.has(row.placeId)) {
      firstPerPlace.set(row.placeId, row.url);
    }
  }
  return firstPerPlace;
}
