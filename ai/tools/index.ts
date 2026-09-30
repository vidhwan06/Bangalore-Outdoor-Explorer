// AI Tool Interfaces
// These define the structured tools the AI agent can use
// Implementation will be in separate service files

import { z } from 'zod';
import { placeCategorySchema, placeStatusSchema, trustLevelSchema, visibilityLevelSchema } from '@/lib/validation/schemas';

// ============================================
// TOOL INPUT/OUTPUT SCHEMAS
// ============================================

// Search places
export const searchPlacesInputSchema = z.object({
  query: z.string().optional(),
  filters: z
    .object({
      category: placeCategorySchema.optional(),
      subcategory: z.string().optional(),
      region: z.string().optional(),
      locality: z.string().optional(),
      status: placeStatusSchema.optional(),
      trustLevel: trustLevelSchema.optional(),
      minDifficulty: z.number().int().min(1).max(5).optional(),
      maxDifficulty: z.number().int().min(1).max(5).optional(),
      minDistanceKm: z.number().positive().optional(),
      maxDistanceKm: z.number().positive().optional(),
      hasParking: z.boolean().optional(),
      hasWater: z.boolean().optional(),
      hasNetwork: z.boolean().optional(),
      permitRequired: z.boolean().optional(),
      minTrustScore: z.number().min(0).max(100).optional(),
      bestSeasonMonth: z.number().int().min(1).max(12).optional(),
    })
    .optional(),
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
  limit: z.number().int().positive().max(50).default(20),
});

export const placeResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  shortDescription: z.string().nullable(),
  category: placeCategorySchema,
  subcategory: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  region: z.string().nullable(),
  locality: z.string().nullable(),
  difficulty: z.number().int().nullable(),
  trailDistanceKm: z.number().nullable(),
  durationHours: z.number().nullable(),
  elevationM: z.number().int().nullable(),
  elevationGainM: z.number().int().nullable(),
  status: placeStatusSchema,
  trustScore: z.number(),
  trustLevel: trustLevelSchema,
  visibilityLevel: visibilityLevelSchema,
  hasParking: z.boolean(),
  hasWater: z.boolean(),
  hasNetwork: z.boolean(),
  permitRequired: z.boolean(),
  crowdLevel: z.number().int().nullable(),
  primaryPhotoUrl: z.string().nullable(),
  distanceKm: z.number().optional(),
});

export const searchPlacesOutputSchema = z.object({
  places: z.array(placeResultSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

// Find nearby places
export const findPlacesNearbyInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive().default(25),
  category: placeCategorySchema.optional(),
  limit: z.number().int().positive().max(50).default(20),
  minTrustScore: z.number().min(0).max(100).optional(),
});

export const findPlacesNearbyOutputSchema = z.array(placeResultSchema);

// Get place details
export const getPlaceDetailsInputSchema = z.object({
  placeId: z.string().cuid(),
  includeTrails: z.boolean().default(true),
  includeConditions: z.boolean().default(true),
  includeWeather: z.boolean().default(false),
  includeNearby: z.boolean().default(false),
  includePermits: z.boolean().default(true),
  includeReviews: z.boolean().default(false),
  includePhotos: z.boolean().default(true),
});

export const trailDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  distanceKm: z.number(),
  elevationGainM: z.number().int().nullable(),
  difficulty: z.number().int().nullable(),
  estimatedHours: z.number().nullable(),
  isLoop: z.boolean(),
  isAccessible: z.boolean(),
  recentReports: z
    .array(
      z.object({
        condition: z.string(),
        description: z.string().nullable(),
        reportedAt: z.string().datetime(),
      })
    )
    .optional(),
});

export const conditionDetailSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  isOfficial: z.boolean(),
  isActive: z.boolean(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  sourceType: z.string(),
});

export const weatherDetailSchema = z.object({
  current: z
    .object({
      temperature: z.number(),
      condition: z.string(),
      humidity: z.number(),
      windSpeed: z.number(),
      precipitation: z.number().optional(),
    })
    .nullable(),
  forecast: z
    .array(
      z.object({
        date: z.string().datetime(),
        tempMin: z.number(),
        tempMax: z.number(),
        condition: z.string(),
        precipitationProbability: z.number(),
      })
    )
    .optional(),
});

export const nearbyFoodSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  cuisine: z.string().nullable(),
  distanceKm: z.number(),
  rating: z.number().nullable(),
  openingHours: z.string().nullable(),
});

export const nearbyFacilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  distanceKm: z.number(),
  openingHours: z.string().nullable(),
  phone: z.string().nullable(),
});

export const permitDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  authority: z.string(),
  applicationUrl: z.string().nullable(),
  costInr: z.number().int().nullable(),
  processingDays: z.number().int().nullable(),
  maxGroupSize: z.number().int().nullable(),
  requiresGuide: z.boolean(),
  isActive: z.boolean(),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
});

export const reviewSummarySchema = z.object({
  averageRating: z.number(),
  totalReviews: z.number(),
  recentReviews: z
    .array(
      z.object({
        rating: z.number().int(),
        title: z.string().nullable(),
        content: z.string().nullable(),
        visitDate: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
      })
    )
    .max(5),
});

export const getPlaceDetailsOutputSchema = z.object({
  place: placeResultSchema.extend({
    description: z.string().nullable(),
    openingTime: z.string().nullable(),
    closingTime: z.string().nullable(),
    lastEntryTime: z.string().nullable(),
    entryFeeInr: z.number().int().nullable(),
    permitDetails: z.string().nullable(),
    permitUrl: z.string().nullable(),
    parkingDetails: z.string().nullable(),
    waterDetails: z.string().nullable(),
    networkDetails: z.string().nullable(),
    bestSeasonStart: z.number().int().nullable(),
    bestSeasonEnd: z.number().int().nullable(),
    lastVerifiedAt: z.string().datetime().nullable(),
    verificationNotes: z.string().nullable(),
    sourceReferences: z
      .array(
        z.object({
          type: z.string(),
          url: z.string().optional(),
          title: z.string().optional(),
          accessedAt: z.string().datetime().optional(),
        })
      )
      .optional(),
  }),
  trails: z.array(trailDetailSchema).optional(),
  conditions: z.array(conditionDetailSchema).optional(),
  weather: weatherDetailSchema.optional(),
  nearbyFood: z.array(nearbyFoodSchema).optional(),
  nearbyFacilities: z.array(nearbyFacilitySchema).optional(),
  permits: z.array(permitDetailSchema).optional(),
  reviews: reviewSummarySchema.optional(),
  photos: z
    .array(
      z.object({
        url: z.string(),
        thumbnailUrl: z.string().nullable(),
        caption: z.string().nullable(),
        isPrimary: z.boolean(),
      })
    )
    .optional(),
});

// Get recent conditions
export const getRecentConditionsInputSchema = z.object({
  placeId: z.string().cuid(),
  types: z
    .array(z.enum(['trail', 'water_level', 'crowd', 'hazard', 'weather', 'closure']))
    .optional(),
  days: z.number().int().positive().max(90).default(30),
  activeOnly: z.boolean().default(true),
});

export const getRecentConditionsOutputSchema = z.array(
  z.object({
    id: z.string(),
    type: z.string(),
    severity: z.number().int(),
    title: z.string(),
    description: z.string().nullable(),
    isOfficial: z.boolean(),
    isActive: z.boolean(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    sourceType: z.string(),
    reportedBy: z
      .object({
        name: z.string().nullable(),
      })
      .nullable(),
  })
);

// Get weather
export const getWeatherInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  dateTime: z.string().datetime().optional(), // For forecast
  includeHourly: z.boolean().default(true),
  includeDaily: z.boolean().default(true),
  includeAlerts: z.boolean().default(true),
});

export const getWeatherOutputSchema = z.object({
  current: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windDirection: z.number(),
    condition: z.string(),
    description: z.string(),
    icon: z.string(),
    timestamp: z.string().datetime(),
  }),
  hourly: z
    .array(
      z.object({
        timestamp: z.string().datetime(),
        temperature: z.number(),
        condition: z.string(),
        precipitationProbability: z.number(),
      })
    )
    .optional(),
  daily: z
    .array(
      z.object({
        date: z.string().datetime(),
        tempMin: z.number(),
        tempMax: z.number(),
        condition: z.string(),
        precipitationProbability: z.number(),
      })
    )
    .optional(),
  alerts: z
    .array(
      z.object({
        event: z.string(),
        severity: z.string(),
        description: z.string(),
        effective: z.string().datetime(),
        expires: z.string().datetime(),
      })
    )
    .optional(),
  outdoorSuitability: z.object({
    suitability: z.enum(['excellent', 'good', 'fair', 'poor', 'dangerous']),
    description: z.string(),
    precautions: z.array(z.string()),
  }),
});

// Get permit status
export const getPermitStatusInputSchema = z.object({
  placeId: z.string().cuid(),
  date: z.string().datetime().optional(), // Date to check for
  groupSize: z.number().int().positive().optional(),
});

export const getPermitStatusOutputSchema = z.object({
  requiresPermit: z.boolean(),
  permits: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      authority: z.string(),
      applicationUrl: z.string().nullable(),
      costInr: z.number().int().nullable(),
      processingDays: z.number().int().nullable(),
      maxGroupSize: z.number().int().nullable(),
      maxDailyVisitors: z.number().int().nullable(),
      requiresGuide: z.boolean(),
      isAvailable: z.boolean(),
      availabilityNote: z.string().nullable(),
    })
  ),
  entryRules: z.array(
    z.object({
      ruleType: z.string(),
      title: z.string(),
      description: z.string(),
      isActive: z.boolean(),
    })
  ),
});

// Calculate route
export const calculateRouteInputSchema = z.object({
  origin: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
  }),
  destination: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
  }),
  waypoints: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        name: z.string().optional(),
      })
    )
    .optional(),
  profile: z.enum(['driving', 'walking', 'cycling']).default('driving'),
  alternatives: z.boolean().default(false),
});

export const routeLegSchema = z.object({
  distanceKm: z.number(),
  durationMinutes: z.number(),
  steps: z.array(
    z.object({
      instruction: z.string(),
      distanceKm: z.number(),
      durationMinutes: z.number(),
      maneuver: z.object({
        type: z.string(),
        instruction: z.string(),
      }),
    })
  ),
  summary: z.string(),
});

export const calculateRouteOutputSchema = z.object({
  routes: z.array(
    z.object({
      geometry: z.object({
        type: z.literal('LineString'),
        coordinates: z.array(z.array(z.number())),
      }),
      distanceKm: z.number(),
      durationMinutes: z.number(),
      legs: z.array(routeLegSchema),
    })
  ),
  waypoints: z.array(
    z.object({
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    })
  ),
});

// Find nearby food
export const findNearbyFoodInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive().default(10),
  type: z.enum(['restaurant', 'cafe', 'dhaba', 'street_food', 'mess']).optional(),
  minRating: z.number().min(0).max(5).optional(),
  openNow: z.boolean().default(false),
  limit: z.number().int().positive().max(20).default(10),
});

export const findNearbyFoodOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    cuisine: z.string().nullable(),
    distanceKm: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    openingHours: z.string().nullable(),
    priceRange: z.number().int().nullable(),
    rating: z.number().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    isVerified: z.boolean(),
  })
);

// Find nearby facilities
export const findNearbyFacilitiesInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive().default(25),
  type: z
    .enum(['fuel', 'hospital', 'police', 'toilet', 'water', 'parking', 'accommodation', 'atm'])
    .optional(),
  limit: z.number().int().positive().max(20).default(10),
});

export const findNearbyFacilitiesOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    distanceKm: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    openingHours: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    isVerified: z.boolean(),
  })
);

// User preferences
export const getUserPreferencesInputSchema = z.object({
  userId: z.string().cuid(),
});

export const getUserPreferencesOutputSchema = z.object({
  preferredCategories: z.array(placeCategorySchema),
  preferredDifficulty: z.number().int().min(1).max(5).nullable(),
  maxTravelDistanceKm: z.number().positive().nullable(),
  preferredActivities: z.array(z.string()),
  avoidCrowds: z.boolean(),
  transportMode: z.enum(['car', 'bike', 'bus', 'mixed']).nullable(),
  homeLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable(),
});

// Saved places
export const getSavedPlacesInputSchema = z.object({
  userId: z.string().cuid(),
  collectionId: z.string().cuid().optional(),
  limit: z.number().int().positive().max(100).default(50),
});

export const getSavedPlacesOutputSchema = z.array(
  z.object({
    id: z.string(),
    placeId: z.string(),
    placeName: z.string(),
    placeSlug: z.string(),
    category: placeCategorySchema,
    latitude: z.number(),
    longitude: z.number(),
    primaryPhotoUrl: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
);

// Visited places
export const getVisitedPlacesInputSchema = z.object({
  userId: z.string().cuid(),
  limit: z.number().int().positive().max(100).default(50),
  since: z.string().datetime().optional(),
});

export const getVisitedPlacesOutputSchema = z.array(
  z.object({
    placeId: z.string(),
    placeName: z.string(),
    placeSlug: z.string(),
    category: placeCategorySchema,
    visitedAt: z.string().datetime(),
    rating: z.number().int().nullable(),
    photos: z.array(z.string()),
  })
);

// Create itinerary
export const createItineraryInputSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  constraints: z
    .object({
      maxDailyDistanceKm: z.number().positive().optional(),
      maxDailyHours: z.number().positive().optional(),
      preferredCategories: z.array(placeCategorySchema).optional(),
      avoidCategories: z.array(placeCategorySchema).optional(),
      mustVisit: z.array(z.string().cuid()).optional(),
      transportMode: z.enum(['car', 'bike', 'bus', 'mixed']).optional(),
      budgetInr: z.number().int().positive().optional(),
    })
    .optional(),
  isTemplate: z.boolean().default(false),
});

export const itineraryItemOutputSchema = z.object({
  dayNumber: z.number().int(),
  orderIndex: z.number().int(),
  placeId: z.string(),
  placeName: z.string(),
  placeSlug: z.string(),
  category: placeCategorySchema,
  latitude: z.number(),
  longitude: z.number(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  travelFromPrevious: z
    .object({
      distanceKm: z.number(),
      durationMinutes: z.number(),
      mode: z.string(),
    })
    .nullable(),
  notes: z.string().nullable(),
});

export const createItineraryOutputSchema = z.object({
  itineraryId: z.string(),
  name: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  totalDays: z.number().int(),
  totalDistanceKm: z.number(),
  totalDurationHours: z.number(),
  items: z.array(itineraryItemOutputSchema),
  warnings: z.array(z.string()),
});

// Rank candidates
export const rankCandidatesInputSchema = z.object({
  candidates: z.array(
    z.object({
      placeId: z.string(),
      placeName: z.string(),
      category: placeCategorySchema,
      latitude: z.number(),
      longitude: z.number(),
      distanceKm: z.number().optional(),
      difficulty: z.number().int().nullable(),
      trustScore: z.number(),
      status: placeStatusSchema,
      hasParking: z.boolean(),
      hasWater: z.boolean(),
      crowdLevel: z.number().int().nullable(),
      weatherSuitability: z.enum(['excellent', 'good', 'fair', 'poor', 'dangerous']).optional(),
    })
  ),
  preferences: z
    .object({
      preferredCategories: z.array(placeCategorySchema).optional(),
      preferredDifficulty: z.number().int().min(1).max(5).optional(),
      maxDistanceKm: z.number().positive().optional(),
      avoidCrowds: z.boolean().optional(),
      prioritizeVerified: z.boolean().optional(),
      transportMode: z.enum(['car', 'bike', 'bus', 'mixed']).optional(),
    })
    .optional(),
  context: z
    .object({
      userLatitude: z.number().optional(),
      userLongitude: z.number().optional(),
      dateTime: z.string().datetime().optional(),
      groupSize: z.number().int().positive().optional(),
      availableHours: z.number().positive().optional(),
    })
    .optional(),
  limit: z.number().int().positive().max(50).default(20),
});

export const rankCandidatesOutputSchema = z.array(
  z.object({
    placeId: z.string(),
    rank: z.number().int(),
    score: z.number(), // 0-100
    reasons: z.array(z.string()),
    warnings: z.array(z.string()),
  })
);

// ============================================
// TOOL DEFINITIONS
// ============================================

export interface ToolDefinition<TInput extends z.ZodSchema, TOutput extends z.ZodSchema> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}

export type SearchPlacesTool = ToolDefinition<
  typeof searchPlacesInputSchema,
  typeof searchPlacesOutputSchema
>;

export type FindPlacesNearbyTool = ToolDefinition<
  typeof findPlacesNearbyInputSchema,
  typeof findPlacesNearbyOutputSchema
>;

export type GetPlaceDetailsTool = ToolDefinition<
  typeof getPlaceDetailsInputSchema,
  typeof getPlaceDetailsOutputSchema
>;

export type GetRecentConditionsTool = ToolDefinition<
  typeof getRecentConditionsInputSchema,
  typeof getRecentConditionsOutputSchema
>;

export type GetWeatherTool = ToolDefinition<
  typeof getWeatherInputSchema,
  typeof getWeatherOutputSchema
>;

export type GetPermitStatusTool = ToolDefinition<
  typeof getPermitStatusInputSchema,
  typeof getPermitStatusOutputSchema
>;

export type CalculateRouteTool = ToolDefinition<
  typeof calculateRouteInputSchema,
  typeof calculateRouteOutputSchema
>;

export type FindNearbyFoodTool = ToolDefinition<
  typeof findNearbyFoodInputSchema,
  typeof findNearbyFoodOutputSchema
>;

export type FindNearbyFacilitiesTool = ToolDefinition<
  typeof findNearbyFacilitiesInputSchema,
  typeof findNearbyFacilitiesOutputSchema
>;

export type GetUserPreferencesTool = ToolDefinition<
  typeof getUserPreferencesInputSchema,
  typeof getUserPreferencesOutputSchema
>;

export type GetSavedPlacesTool = ToolDefinition<
  typeof getSavedPlacesInputSchema,
  typeof getSavedPlacesOutputSchema
>;

export type GetVisitedPlacesTool = ToolDefinition<
  typeof getVisitedPlacesInputSchema,
  typeof getVisitedPlacesOutputSchema
>;

export type CreateItineraryTool = ToolDefinition<
  typeof createItineraryInputSchema,
  typeof createItineraryOutputSchema
>;

export type RankCandidatesTool = ToolDefinition<
  typeof rankCandidatesInputSchema,
  typeof rankCandidatesOutputSchema
>;

// ============================================
// TOOL REGISTRY
// ============================================

export const AI_TOOLS = {
  search_places: 'search_places',
  find_places_nearby: 'find_places_nearby',
  get_place_details: 'get_place_details',
  get_recent_conditions: 'get_recent_conditions',
  get_weather: 'get_weather',
  get_permit_status: 'get_permit_status',
  calculate_route: 'calculate_route',
  find_nearby_food: 'find_nearby_food',
  find_nearby_facilities: 'find_nearby_facilities',
  get_user_preferences: 'get_user_preferences',
  get_saved_places: 'get_saved_places',
  get_visited_places: 'get_visited_places',
  create_itinerary: 'create_itinerary',
  rank_candidates: 'rank_candidates',
} as const;

export type AIToolName = (typeof AI_TOOLS)[keyof typeof AI_TOOLS];

// Tool descriptions for the AI
export const TOOL_DESCRIPTIONS: Record<AIToolName, string> = {
  search_places: 'Search for places with filters. Use for general discovery and filtered searches.',
  find_places_nearby:
    'Find places near specific coordinates. Use for "near me" or location-based searches.',
  get_place_details:
    'Get comprehensive details for a specific place. Use when user asks about a specific destination.',
  get_recent_conditions:
    'Get recent trail/weather/crowd conditions for a place. Use for current status questions.',
  get_weather:
    'Get current weather and forecast for coordinates. Use for weather-related planning.',
  get_permit_status: 'Check permit requirements and availability for a place on a specific date.',
  calculate_route:
    'Calculate route, distance, and travel time between locations. Use for travel planning.',
  find_nearby_food: 'Find food options near coordinates. Use for meal planning during trips.',
  find_nearby_facilities:
    'Find facilities (fuel, hospital, parking, etc.) near coordinates. Use for safety/logistics.',
  get_user_preferences: 'Get user preferences for personalized recommendations.',
  get_saved_places: 'Get user saved places. Use for "my saved places" queries.',
  get_visited_places: 'Get user visit history. Use for "places I visited" queries.',
  create_itinerary:
    'Create a multi-day itinerary based on constraints. Use for trip planning requests.',
  rank_candidates:
    'Rank candidate places based on preferences and context. Use for personalized recommendations.',
};
