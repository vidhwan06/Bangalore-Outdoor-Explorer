# Phase 0 Database Defect Fixes Report

## Changes Made

### 1. New file: `lib/db/postgis.ts`
**Purpose**: Provides a clean, explicit Phase 0-compatible strategy for PostGIS location writes.
**Defect addressed**: Prisma schema maps `Place.location` as `Unsupported("geography(Point, 4326)")`, meaning normal Prisma CRUD ignores this column. The SQL migration has `location GEOGRAPHY(POINT, 4326) NOT NULL`. The seed works around this with a two-step pattern (Prisma create + raw SQL UPDATE), but future repository/service code needs a reusable approach.

**Utility function**:
```typescript
export async function setPlaceLocation(
  slug: string,
  longitude: number,
  latitude: number
): Promise<void>
```
Uses parameterized `ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography` via `$executeRawUnsafe`. Future code imports this and calls it after Prisma `place.create/`update`.

**Rationale**: Small, well-isolated helper as preferred by the task decision rule. Does not redesign the architecture. Keeps Prisma `Unsupported()` in place (which is correct — Prisma cannot natively handle geography).

### 2. Modified: `prisma/migrations/02_create_tables/migration.sql`
**Defect addressed**: The migration created `update_place_photo_updated_at` and `update_place_video_updated_at` triggers that invoke `update_updated_at_column()`, which sets `NEW."updatedAt" = NOW()`. However, PlacePhoto and PlaceVideo tables have NO `updatedAt` column. This is a confirmed migration defect — the triggers would fail on any UPDATE operation.

**Fix**: Removed the two broken trigger lines from the migration. The remaining updated_at triggers (User, Profile, Place, OfficialSource) are preserved since those tables DO have `updatedAt` columns matching the Prisma schema (`@updatedAt`). The Prisma schema does not define `updatedAt` for PlacePhoto or PlaceVideo, so removing the inconsistent triggers keeps the migration semantically aligned with the schema.

**Lines removed** (previously lines 197-199):
```
CREATE TRIGGER update_place_photo_updated_at BEFORE UPDATE ON "PlacePhoto" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_place_video_updated_at BEFORE UPDATE ON "PlaceVideo" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. Modified: `prisma/seed.ts`
**Defect addressed**: The OfficialSource upsert used `where: { id: sourceData.name }`. OfficialSource.id is a generated `cuid()` (e.g., "cjydab1234ab"), so this where-clause never matches a real record since ids are cryptographic UUIDs, not human-readable names. The comment acknowledged "Using name as unique identifier for demo" but the code used `id` as the key. This meant the upsert always took the `create` branch, making seeding **non-idempotent** — running `pnpm db:seed` repeatedly would create duplicate OfficialSource records.

**Fix**: Changed `where: { id: sourceData.name }` to `where: { name: sourceData.name }`. This matches the documented intent (idempotent seeding by name) and makes the seeding truly idempotent. Since the demo data names are unique ("Karnataka Forest Department (DEMO)", "Karnataka Tourism Department (DEMO)", "Archaeological Survey of India - Bengaluru Circle (DEMO)"), the upsert correctly updates existing records on re-run instead of creating duplicates.

## Validation Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Passed (no output, strict mode) |
| `npm run lint` | Passed — "No ESLint warnings or errors" |
| `npm test` | Passed — "No tests found, exiting with code 0" |
| `npm run build` | Passed — successful build, 2 metadataBase warnings |
| `prisma validate` | Fails expectedly — `DATABASE_URL` not set (no running database), not a schema error |

## Summary of Defects Fixed

| Defect | File | Fix |
|---|---|---|
| Place.location: Prisma cannot write PostGIS geography | `lib/db/postgis.ts` (new) | Created `setPlaceLocation()` helper for future repository/service code — Prisma create/update + raw SQL SET geometry |
| PlacePhoto/PlaceVideo triggers reference non-existent updatedAt column | `prisma/migrations/02_create_tables/migration.sql` | Removed two broken triggers; kept triggers for tables that have updatedAt columns |
| OfficialSource seed upsert never matches (non-idempotent) | `prisma/seed.ts` | Changed `where: { id: sourceData.name }` → `where: { name: sourceData.name }` |

## Files Changed

- **New**: `lib/db/postgis.ts` (1 file, 24 lines)
- **Modified**: `prisma/migrations/02_create_tables/migration.sql` (trigger removal)
- **Modified**: `prisma/seed.ts` (OfficialSource upsert key)

No unrelated files were changed. No API routes, providers, auth, or frontend changes were made. The changes are strictly scoped to the verified Phase 0 database defects.