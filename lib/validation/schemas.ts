// Validation schemas using Zod
import { z } from 'zod';

// ============================================
// PLACE SCHEMAS
// ============================================

export const placeCategorySchema = z.enum([
  'TREK',
  'HIKE',
  'WATERFALL',
  'LAKE',
  'MOUNTAIN',
  'FOREST',
  'CAVE',
  'FORT',
  'VIEWPOINT',
  'CAMPING',
  'CYCLING',
  'SCENIC_DRIVE',
  'HIDDEN_GEM',
]);

export const placeStatusSchema = z.enum([
  'OPEN',
  'PERMIT_REQUIRED',
  'LIMITED_SLOTS',
  'CLOSED',
  'WEATHER_CONCERN',
  'UNVERIFIED',
]);

export const visibilityLevelSchema = z.enum([
  'PUBLIC_EXACT',
  'PUBLIC_APPROXIMATE',
  'VERIFIED_COMMUNITY_ONLY',
  'MODERATOR_ONLY',
  'PRIVATE',
]);

export const trustLevelSchema = z.enum([
  'VERIFIED',
  'COMMUNITY_SUBMITTED',
  'INFORMATION_OUTDATED',
  'CLOSED_RESTRICTED',
  'UNDER_REVIEW',
]);

export const placeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(250).optional(),
  description: z.string().max(10000).optional(),
  shortDescription: z.string().max(500).optional(),
  category: placeCategorySchema,
  subcategory: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  region: z.string().max(100).optional(),
  locality: z.string().max(100).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  trailDistanceKm: z.number().positive().optional(),
  durationHours: z.number().positive().optional(),
  elevationM: z.number().int().nonnegative().optional(),
  elevationGainM: z.number().int().nonnegative().optional(),
  openingTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  closingTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  lastEntryTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  entryFeeInr: z.number().int().nonnegative().optional(),
  permitRequired: z.boolean().default(false),
  permitDetails: z.string().max(2000).optional(),
  permitUrl: z.string().url().optional(),
  hasParking: z.boolean().default(false),
  parkingDetails: z.string().max(1000).optional(),
  hasWater: z.boolean().default(false),
  waterDetails: z.string().max(1000).optional(),
  hasNetwork: z.boolean().default(false),
  networkDetails: z.string().max(1000).optional(),
  crowdLevel: z.number().int().min(1).max(5).optional(),
  bestSeasonStart: z.number().int().min(1).max(12).optional(),
  bestSeasonEnd: z.number().int().min(1).max(12).optional(),
  status: placeStatusSchema.default('UNVERIFIED'),
  visibilityLevel: visibilityLevelSchema.default('PUBLIC_EXACT'),
  sourceReferences: z
    .array(
      z.object({
        type: z.string(),
        url: z.string().url().optional(),
        title: z.string().optional(),
        accessedAt: z.string().datetime().optional(),
      })
    )
    .optional(),
});

export const placeUpdateSchema = placeCreateSchema.partial();

export const placeFilterSchema = z.object({
  category: placeCategorySchema.optional(),
  subcategory: z.string().optional(),
  region: z.string().optional(),
  locality: z.string().optional(),
  status: placeStatusSchema.optional(),
  trustLevel: trustLevelSchema.optional(),
  minDifficulty: z.number().int().min(1).max(5).optional(),
  maxDifficulty: z.number().int().min(1).max(5).optional(),
  minDistance: z.number().positive().optional(),
  maxDistance: z.number().positive().optional(),
  hasParking: z.boolean().optional(),
  hasWater: z.boolean().optional(),
  hasNetwork: z.boolean().optional(),
  permitRequired: z.boolean().optional(),
  minTrustScore: z.number().min(0).max(100).optional(),
  search: z.string().optional(),
  bounds: z
    .object({
      north: z.number(),
      south: z.number(),
      east: z.number(),
      west: z.number(),
    })
    .optional(),
  center: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  radiusKm: z.number().positive().optional(),
  sortBy: z
    .enum(['name', 'distance', 'difficulty', 'trustScore', 'createdAt', 'popularity'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// ============================================
// USER SCHEMAS
// ============================================

export const userRoleSchema = z.enum(['USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN']);

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  role: userRoleSchema.default('USER'),
});

export const userUpdateSchema = userCreateSchema.partial();

export const profileUpdateSchema = z.object({
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
  preferences: z.record(z.unknown()).optional(),
});

// ============================================
// COMMUNITY SCHEMAS
// ============================================

export const submissionStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'NEEDS_MORE_INFO',
  'UNDER_REVIEW',
]);

export const communitySubmissionCreateSchema = z.object({
  placeId: z.string().cuid().optional(),
  type: z.enum([
    'new_place',
    'place_update',
    'trail_update',
    'condition_report',
    'photo',
    'correction',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  data: z.record(z.unknown()),
  photos: z.array(z.string().url()).max(10).default([]),
});

export const communitySubmissionReviewSchema = z.object({
  status: submissionStatusSchema,
  reviewNotes: z.string().max(2000).optional(),
});

export const postCreateSchema = z.object({
  placeId: z.string().cuid().optional(),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
  type: z.enum(['visit_report', 'photo_share', 'tip', 'question', 'trip_report']),
  photos: z.array(z.string().url()).max(10).default([]),
  isPublic: z.boolean().default(true),
});

export const commentCreateSchema = z.object({
  postId: z.string().cuid(),
  content: z.string().min(1).max(5000),
  parentId: z.string().cuid().optional(),
});

export const reviewCreateSchema = z.object({
  placeId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  visitDate: z.string().datetime().optional(),
  photos: z.array(z.string().url()).max(10).default([]),
});

// ============================================
// TRAIL SCHEMAS
// ============================================

export const trailCreateSchema = z.object({
  placeId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  distanceKm: z.number().positive(),
  elevationGainM: z.number().int().nonnegative().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  estimatedHours: z.number().positive().optional(),
  isLoop: z.boolean().default(false),
  isAccessible: z.boolean().default(false),
  gpxUrl: z.string().url().optional(),
});

export const trailReportCreateSchema = z.object({
  trailId: z.string().cuid(),
  condition: z.enum(['good', 'muddy', 'rocky', 'overgrown', 'blocked', 'closed', 'flooded', 'icy']),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(5).default([]),
});

// ============================================
// CONDITION SCHEMAS
// ============================================

export const conditionCreateSchema = z.object({
  placeId: z.string().cuid(),
  type: z.enum(['trail', 'water_level', 'crowd', 'hazard', 'weather', 'closure']),
  severity: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceType: z
    .enum([
      'OFFICIAL_GOVERNMENT',
      'OFFICIAL_PARK_AUTHORITY',
      'OFFICIAL_TOURISM_BOARD',
      'VERIFIED_CONTRIBUTOR',
      'COMMUNITY_REPORT',
      'SATELLITE_IMAGERY',
      'USER_VISIT',
      'THIRD_PARTY_API',
    ])
    .default('COMMUNITY_REPORT'),
  isOfficial: z.boolean().default(false),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const hazardReportCreateSchema = z.object({
  placeId: z.string().cuid(),
  type: z.enum(['landslide', 'flash_flood', 'wildlife', 'fire', 'structural', 'other']),
  severity: z.number().int().min(1).max(5),
  description: z.string().min(1).max(2000),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
});

// ============================================
// TRIP SCHEMAS
// ============================================

export const itineraryCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isPublic: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
  coverImage: z.string().url().optional(),
});

export const itineraryItemCreateSchema = z.object({
  itineraryId: z.string().cuid(),
  placeId: z.string().cuid(),
  dayNumber: z.number().int().positive(),
  orderIndex: z.number().int().nonnegative(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  notes: z.string().max(2000).optional(),
  transportMode: z.string().max(50).optional(),
});

// ============================================
// EXPLORATION SCHEMAS
// ============================================

export const userVisitCreateSchema = z.object({
  placeId: z.string().cuid(),
  visitedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(10).default([]),
  companions: z.number().int().nonnegative().default(0),
  transportMode: z.string().max(50).optional(),
});

export const savedPlaceCreateSchema = z.object({
  placeId: z.string().cuid(),
  collectionId: z.string().cuid().optional(),
  notes: z.string().max(1000).optional(),
});

export const collectionCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
  coverImage: z.string().url().optional(),
});

// ============================================
// NEARBY SCHEMAS
// ============================================

export const nearbyFoodCreateSchema = z.object({
  placeId: z.string().cuid(),
  name: z.string().min(1).max(200),
  type: z.enum(['restaurant', 'cafe', 'dhaba', 'street_food', 'mess']),
  cuisine: z.string().max(100).optional(),
  distanceKm: z.number().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openingHours: z.string().max(200).optional(),
  priceRange: z.number().int().min(1).max(4).optional(),
  rating: z.number().min(0).max(5).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

export const nearbyFacilityCreateSchema = z.object({
  placeId: z.string().cuid(),
  name: z.string().min(1).max(200),
  type: z.enum([
    'fuel',
    'hospital',
    'police',
    'toilet',
    'water',
    'parking',
    'accommodation',
    'atm',
  ]),
  distanceKm: z.number().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openingHours: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

// ============================================
// PERMIT & ACCESS SCHEMAS
// ============================================

export const permitCreateSchema = z.object({
  placeId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  authority: z.string().min(1).max(200),
  applicationUrl: z.string().url().optional(),
  costInr: z.number().int().nonnegative().optional(),
  processingDays: z.number().int().positive().optional(),
  maxGroupSize: z.number().int().positive().optional(),
  maxDailyVisitors: z.number().int().positive().optional(),
  requiresGuide: z.boolean().default(false),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

export const entryRuleCreateSchema = z.object({
  placeId: z.string().cuid(),
  ruleType: z.enum(['timing', 'group_size', 'vehicle', 'guide', 'booking', 'restriction']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  sourceId: z.string().cuid().optional(),
});

// ============================================
// OFFICIAL SOURCE SCHEMAS
// ============================================

export const officialSourceCreateSchema = z.object({
  placeId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  type: z.enum([
    'OFFICIAL_GOVERNMENT',
    'OFFICIAL_PARK_AUTHORITY',
    'OFFICIAL_TOURISM_BOARD',
    'VERIFIED_CONTRIBUTOR',
    'COMMUNITY_REPORT',
    'SATELLITE_IMAGERY',
    'USER_VISIT',
    'THIRD_PARTY_API',
  ]),
  url: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type PlaceCreateInput = z.infer<typeof placeCreateSchema>;
export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>;
export type PlaceFilterInput = z.infer<typeof placeFilterSchema>;
export type PlaceCategory = z.infer<typeof placeCategorySchema>;
export type PlaceStatus = z.infer<typeof placeStatusSchema>;
export type VisibilityLevel = z.infer<typeof visibilityLevelSchema>;
export type TrustLevel = z.infer<typeof trustLevelSchema>;

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;

export type CommunitySubmissionCreateInput = z.infer<typeof communitySubmissionCreateSchema>;
export type CommunitySubmissionReviewInput = z.infer<typeof communitySubmissionReviewSchema>;

export type PostCreateInput = z.infer<typeof postCreateSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export type TrailCreateInput = z.infer<typeof trailCreateSchema>;
export type TrailReportCreateInput = z.infer<typeof trailReportCreateSchema>;

export type ConditionCreateInput = z.infer<typeof conditionCreateSchema>;
export type HazardReportCreateInput = z.infer<typeof hazardReportCreateSchema>;

export type ItineraryCreateInput = z.infer<typeof itineraryCreateSchema>;
export type ItineraryItemCreateInput = z.infer<typeof itineraryItemCreateSchema>;

export type UserVisitCreateInput = z.infer<typeof userVisitCreateSchema>;
export type SavedPlaceCreateInput = z.infer<typeof savedPlaceCreateSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;

export type NearbyFoodCreateInput = z.infer<typeof nearbyFoodCreateSchema>;
export type NearbyFacilityCreateInput = z.infer<typeof nearbyFacilityCreateSchema>;

export type PermitCreateInput = z.infer<typeof permitCreateSchema>;
export type EntryRuleCreateInput = z.infer<typeof entryRuleCreateSchema>;

export type OfficialSourceCreateInput = z.infer<typeof officialSourceCreateSchema>;
