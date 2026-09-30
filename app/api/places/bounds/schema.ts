// Zod validation schema for the bounds (map viewport) places API endpoint
import { z } from 'zod';
import { placeCategorySchema, placeStatusSchema } from '@/lib/validation/schemas';

/**
 * Query parameters for GET /api/places/bounds
 * north/south are latitudes and east/west are longitudes of the visible
 * viewport (north > south, east > west; antimeridian-crossing viewports
 * are not supported).
 */
export const boundsPlacesQuerySchema = z
  .object({
    north: z.coerce.number().min(-90).max(90, 'north must be between -90 and 90'),
    south: z.coerce.number().min(-90).max(90, 'south must be between -90 and 90'),
    east: z.coerce.number().min(-180).max(180, 'east must be between -180 and 180'),
    west: z.coerce.number().min(-180).max(180, 'west must be between -180 and 180'),

    // Pagination
    limit: z.coerce.number().int().positive().max(100, 'Maximum limit is 100').default(20),
    offset: z.coerce.number().int().nonnegative().default(0),

    // Optional filters
    category: placeCategorySchema.optional(),
    status: placeStatusSchema.optional(),
    difficulty: z.coerce.number().int().min(1).max(5).optional(),
  })
  .refine((value) => value.north > value.south, {
    message: 'north must be greater than south',
    path: ['north'],
  })
  .refine((value) => value.east > value.west, {
    message: 'east must be greater than west',
    path: ['east'],
  });

export type BoundsPlacesQueryInput = z.infer<typeof boundsPlacesQuerySchema>;
