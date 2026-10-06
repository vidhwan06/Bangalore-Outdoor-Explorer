-- Main schema migration (Phase 0)
-- Creates foundational tables with PostGIS and database-level CHECK constraints

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE place_category AS ENUM (
  'TREK', 'HIKE', 'WATERFALL', 'LAKE', 'MOUNTAIN', 'FOREST',
  'CAVE', 'FORT', 'VIEWPOINT', 'CAMPING', 'CYCLING', 'SCENIC_DRIVE', 'HIDDEN_GEM'
);

CREATE TYPE place_status AS ENUM (
  'OPEN', 'PERMIT_REQUIRED', 'LIMITED_SLOTS', 'CLOSED', 'WEATHER_CONCERN', 'UNVERIFIED'
);

CREATE TYPE visibility_level AS ENUM (
  'PUBLIC_EXACT', 'PUBLIC_APPROXIMATE', 'VERIFIED_COMMUNITY_ONLY', 'MODERATOR_ONLY', 'PRIVATE'
);

CREATE TYPE trust_level AS ENUM (
  'VERIFIED', 'COMMUNITY_SUBMITTED', 'INFORMATION_OUTDATED', 'CLOSED_RESTRICTED', 'UNDER_REVIEW'
);

CREATE TYPE verification_source_type AS ENUM (
  'OFFICIAL_GOVERNMENT', 'OFFICIAL_PARK_AUTHORITY', 'OFFICIAL_TOURISM_BOARD',
  'VERIFIED_CONTRIBUTOR', 'COMMUNITY_REPORT', 'SATELLITE_IMAGERY', 'USER_VISIT', 'THIRD_PARTY_API'
);

CREATE TYPE user_role AS ENUM (
  'USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN'
);

-- ============================================
-- USERS & PROFILES
-- ============================================

CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  "avatarUrl" TEXT,
  role user_role NOT NULL DEFAULT 'USER',
  "emailVerified" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_role ON "User"(role);

CREATE TABLE "Profile" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,
  bio TEXT,
  location TEXT,
  website TEXT,
  preferences JSONB,
  "totalVisits" INT NOT NULL DEFAULT 0,
  "totalContributions" INT NOT NULL DEFAULT 0,
  "trustScore" FLOAT NOT NULL DEFAULT 0 CHECK ("trustScore" >= 0 AND "trustScore" <= 100),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_user ON "Profile"("userId");

-- ============================================
-- PLACES - Core destination entity
-- ============================================

CREATE TABLE "Place" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  "shortDescription" TEXT,
  category place_category NOT NULL,
  subcategory TEXT,
  -- PostGIS geography point (authoritative location)
  -- latitude/longitude are NOT stored as separate columns to avoid dual-write inconsistency.
  -- Application reads lat/lng via ST_Y(location) / ST_X(location) or Prisma raw queries.
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  region TEXT,
  locality TEXT,
  difficulty INT CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 5)),
  "trailDistanceKm" DOUBLE PRECISION CHECK ("trailDistanceKm" IS NULL OR "trailDistanceKm" >= 0),
  "durationHours" DOUBLE PRECISION CHECK ("durationHours" IS NULL OR "durationHours" >= 0),
  "elevationM" INT CHECK ("elevationM" IS NULL OR "elevationM" >= 0),
  "elevationGainM" INT CHECK ("elevationGainM" IS NULL OR "elevationGainM" >= 0),
  "openingTime" TEXT CHECK ("openingTime" IS NULL OR "openingTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "closingTime" TEXT CHECK ("closingTime" IS NULL OR "closingTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "lastEntryTime" TEXT CHECK ("lastEntryTime" IS NULL OR "lastEntryTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "entryFeeInr" INT CHECK ("entryFeeInr" IS NULL OR "entryFeeInr" >= 0),
  "permitRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "permitDetails" TEXT,
  "permitUrl" TEXT,
  "hasParking" BOOLEAN NOT NULL DEFAULT FALSE,
  "parkingDetails" TEXT,
  "hasWater" BOOLEAN NOT NULL DEFAULT FALSE,
  "waterDetails" TEXT,
  "hasNetwork" BOOLEAN NOT NULL DEFAULT FALSE,
  "networkDetails" TEXT,
  "crowdLevel" INT CHECK ("crowdLevel" IS NULL OR ("crowdLevel" >= 1 AND "crowdLevel" <= 5)),
  "bestSeasonStart" INT CHECK ("bestSeasonStart" IS NULL OR ("bestSeasonStart" >= 1 AND "bestSeasonStart" <= 12)),
  "bestSeasonEnd" INT CHECK ("bestSeasonEnd" IS NULL OR ("bestSeasonEnd" >= 1 AND "bestSeasonEnd" <= 12)),
  status place_status NOT NULL DEFAULT 'UNVERIFIED',
  "trustScore" FLOAT NOT NULL DEFAULT 0 CHECK ("trustScore" >= 0 AND "trustScore" <= 100),
  "trustLevel" trust_level NOT NULL DEFAULT 'COMMUNITY_SUBMITTED',
  "visibilityLevel" visibility_level NOT NULL DEFAULT 'PUBLIC_EXACT',
  "lastVerifiedAt" TIMESTAMPTZ,
  "verificationNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById" TEXT,
  "sourceReferences" JSONB,
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX idx_place_category ON "Place"(category);
CREATE INDEX idx_place_status ON "Place"(status);
CREATE INDEX idx_place_trust_level ON "Place"("trustLevel");
CREATE INDEX idx_place_visibility ON "Place"("visibilityLevel");
CREATE INDEX idx_place_region ON "Place"(region);
CREATE INDEX idx_place_locality ON "Place"(locality);
CREATE INDEX idx_place_slug ON "Place"(slug);
-- Spatial index for PostGIS geography
CREATE INDEX idx_place_location_gist ON "Place" USING GIST (location);

CREATE TABLE "PlacePhoto" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "placeId" TEXT NOT NULL,
  url TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  caption TEXT,
  "photographerId" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("placeId") REFERENCES "Place"(id) ON DELETE CASCADE
);

CREATE INDEX idx_place_photo_place ON "PlacePhoto"("placeId");
CREATE INDEX idx_place_photo_primary ON "PlacePhoto"("isPrimary");

CREATE TABLE "PlaceVideo" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "placeId" TEXT NOT NULL,
  url TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  caption TEXT,
  duration INT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("placeId") REFERENCES "Place"(id) ON DELETE CASCADE
);

CREATE INDEX idx_place_video_place ON "PlaceVideo"("placeId");

-- ============================================
-- OFFICIAL SOURCES
-- ============================================

CREATE TABLE "OfficialSource" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "placeId" TEXT,
  "name" TEXT NOT NULL UNIQUE,
  type verification_source_type NOT NULL,
  url TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  description TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastCheckedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("placeId") REFERENCES "Place"(id) ON DELETE SET NULL
);

CREATE INDEX idx_official_source_place ON "OfficialSource"("placeId");
CREATE INDEX idx_official_source_type ON "OfficialSource"(type);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profile_updated_at BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_place_updated_at BEFORE UPDATE ON "Place" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- PlacePhoto and PlaceVideo do not have an updatedAt column;
-- their updatedAt triggers were removed to keep the migration consistent
-- with the Prisma schema (which does not define updatedAt for these models).
CREATE TRIGGER update_official_source_updated_at BEFORE UPDATE ON "OfficialSource" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();