// Zod validation schema for nearby places API endpoint
import { z } from 'zod';
import { placeCategorySchema, placeStatusSchema } from '@/lib/validation/schemas';

/**
 * Query parameters for GET /api/places/nearby
 */
export const nearbyPlacesQuerySchema = z.object({
  // Required coordinates
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),

  // Optional radius in meters (max 50km)
  radius: z.coerce.number().int().positive().max(50000, 'Maximum radius is 50000 meters (50km)').default(10000),

  // Pagination
  limit: z.coerce.number().int().positive().max(100, 'Maximum limit is 100').default(20),
  offset: z.coerce.number().int().nonnegative().default(0),

  // Optional filters
  category: placeCategorySchema.optional(),
  status: placeStatusSchema.optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
});

export type NearbyPlacesQueryInput = z.infer<typeof nearbyPlacesQuerySchema>;