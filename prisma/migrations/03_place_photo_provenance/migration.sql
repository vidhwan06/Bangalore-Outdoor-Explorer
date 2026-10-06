-- 03_place_photo_provenance
--
-- Two goals:
--   1. Make PlacePhoto a trustworthy single source of truth for imagery by
--      requiring an explicit licence and attribution on every photo row.
--   2. Guarantee at the database level that a place can never have more than
--      one primary photo.
--   3. Provide a storage bucket with public reads and no public writes.
--
-- PlacePhoto is empty at the time this migration runs, so the NOT NULL columns
-- can be added directly without a backfill.

-- ============================================
-- PROVENANCE COLUMNS
-- ============================================

ALTER TABLE "PlacePhoto"
  ADD COLUMN "license" TEXT NOT NULL,
  ADD COLUMN "attribution" TEXT NOT NULL,
  ADD COLUMN "altText" TEXT NOT NULL,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "photographerName" TEXT;

-- Trust: a photo must declare where it came from.
-- TEXT + CHECK rather than a Postgres ENUM: the licence vocabulary will grow
-- over time and a CHECK can be widened without rewriting dependent columns.
ALTER TABLE "PlacePhoto"
  ADD CONSTRAINT "PlacePhoto_license_check"
    CHECK ("license" IN (
      'CC0',
      'PUBLIC_DOMAIN',
      'CC_BY',
      'CC_BY_SA',
      'CC_BY_ND',
      'CC_BY_NC',
      'CC_BY_NC_SA',
      'CC_BY_NC_ND',
      'ALL_RIGHTS_RESERVED',
      'PERMISSION_ON_FILE'
    ));

-- Trust: a photo must credit its author. Blank attributions are rejected.
ALTER TABLE "PlacePhoto"
  ADD CONSTRAINT "PlacePhoto_attribution_check"
    CHECK (length(btrim("attribution")) > 0);

-- Accessibility: an image record without alt text is a rendering defect.
ALTER TABLE "PlacePhoto"
  ADD CONSTRAINT "PlacePhoto_altText_check"
    CHECK (length(btrim("altText")) > 0);

-- Provenance link must be an absolute http(s) URL when present.
ALTER TABLE "PlacePhoto"
  ADD CONSTRAINT "PlacePhoto_sourceUrl_check"
    CHECK ("sourceUrl" IS NULL OR "sourceUrl" ~* '^https?://');

-- sortOrder is a display order, not an arbitrary integer.
ALTER TABLE "PlacePhoto"
  ADD CONSTRAINT "PlacePhoto_sortOrder_check"
    CHECK ("sortOrder" >= 0);

-- ============================================
-- PRIMARY-PHOTO INTEGRITY
-- ============================================

-- Expected read pattern: every photo for one place, primary first, then the
-- editor's explicit ordering. Matches
--   ORDER BY "isPrimary" DESC, "sortOrder" ASC
CREATE INDEX idx_place_photo_primary_order
  ON "PlacePhoto"("placeId", "isPrimary", "sortOrder");

-- A place can never have two primary photos.
--
-- This is a PARTIAL unique index, which Prisma's schema language cannot
-- express, so it exists only here as the authoritative DDL. Apply future schema
-- changes with `prisma migrate deploy`; `prisma migrate dev` and
-- `prisma db push` cannot see this index and will report it as drift.
CREATE UNIQUE INDEX idx_place_photo_one_primary
  ON "PlacePhoto"("placeId")
  WHERE "isPrimary";

-- ============================================
-- STORAGE FOUNDATION — public reads, no public writes
-- ============================================

-- Dedicated bucket for place imagery. Public so place discovery and detail
-- pages can render images without a signed request.
--   file_size_limit / allowed_mime_types mirror MAX_FILE_SIZES.IMAGE and
--   FILE_CATEGORIES.IMAGE in lib/storage/index.ts (10 MiB, 5 image types).
--
-- The bucket id is a fixed literal because storage.objects.bucket_id is a text
-- column that stores buckets.ID (not buckets.name) — see the read policy below.
-- It must not be changed without also updating place_photos_public_read.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '3f6a1b2c-8d4e-4f1a-9b7c-5e2d1a0b3c4d',
  'place-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      "file_size_limit" = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      updated_at = NOW();

-- READ: public, scoped to this bucket only.
--
-- The predicate compares against the bucket ID, not the bucket name. In this
-- project storage.objects.bucket_id is a text FK to storage.buckets(id), and
-- buckets.id holds a UUID, so `bucket_id = 'place-photos'` never matches.
-- Verified: SELECT ('place-photos' = id) FROM storage.buckets -> false.
--
-- A join on buckets.name was also rejected: the anon role cannot read
-- storage.buckets (RLS returns 0 rows), so an EXISTS subquery on that table
-- evaluates to false for every object and no image would be visible.
CREATE POLICY place_photos_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = '3f6a1b2c-8d4e-4f1a-9b7c-5e2d1a0b3c4d');

-- WRITE: deliberately absent.
--
-- No INSERT, UPDATE or DELETE policy is created for anon or authenticated.
-- storage.objects has RLS enabled and RLS is default-deny, so:
--   * INSERT raises "new row violates row-level security policy"
--   * UPDATE matches 0 rows (RLS filters them out)
--   * DELETE is additionally refused by Supabase's storage guard trigger
-- Writes go through the server-side application, which connects with a role
-- that has BYPASSRLS (see .env and lib/db/prisma.ts) and is therefore
-- unaffected by these policies.
