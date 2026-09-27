// PostGIS location utility
// Provides a reusable helper for setting the Place geography point
// via raw SQL. Prisma maps Place.location as Unsupported("geography(Point, 4326)"),
// so normal Prisma CRUD does NOT write to this column.
// Future repository/service code should use Prisma create/update followed by
// this helper to set the authoritative spatial coordinate.

import { prisma } from '@/lib/db/prisma';

export async function setPlaceLocation(
  slug: string,
  longitude: number,
  latitude: number
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "Place" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE slug = $3`,
    longitude,
    latitude,
    slug
  );
}