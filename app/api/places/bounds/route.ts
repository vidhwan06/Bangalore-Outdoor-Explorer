// GET /api/places/bounds
// Search for places inside a map viewport (bounding box)
// Query parameters: north, south, east, west, limit, offset, category, status, difficulty

import { NextRequest, NextResponse } from 'next/server';
import { boundsPlacesQuerySchema } from './schema';
import { placeService } from '@/features/places/services';
import { handleApiError, rateLimiters } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (same limiter as the nearby search)
    const rateLimitResult = await rateLimiters.search(request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = boundsPlacesQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { north, south, east, west, limit, offset, category, status, difficulty } =
      validationResult.data;

    // Delegate to the service layer (service -> repository -> PostGIS)
    const result = await placeService.searchInBounds({
      north,
      south,
      east,
      west,
      limit,
      offset,
      category,
      status,
      difficulty,
    });

    const response = NextResponse.json(result);
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
