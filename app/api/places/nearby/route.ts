// GET /api/places/nearby
// Search for places within a radius of a given point
// Query parameters: lat, lng, radius, limit, offset, category, status, difficulty

import { NextRequest, NextResponse } from 'next/server';
import { nearbyPlacesQuerySchema } from './schema';
import { placeService } from '@/features/places/services';
import { handleApiError, rateLimiters } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
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

    const validationResult = nearbyPlacesQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { lat, lng, radius, limit, offset, category, status, difficulty } = validationResult.data;

    // Execute search
    const result = await placeService.searchNearby({
      latitude: lat,
      longitude: lng,
      radiusMeters: radius,
      limit,
      offset,
      category,
      status,
      difficulty,
    });

    // Build response with rate limit headers
    const response = NextResponse.json(result);
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}