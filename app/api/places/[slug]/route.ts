// GET /api/places/[slug]
// Single public place, served from findPlaceBySlug() via the service layer.
//
// Sits alongside /api/places/nearby and /api/places/bounds and follows the same
// conventions: validate with Zod, apply a rate limiter, delegate to placeService
// (never the repository directly), and let handleApiError() shape any failure so
// nothing internal leaks.
//
// The envelope is { data } rather than { data, pagination } because a single
// resource has no pages. The payload is validated against
// placeDetailResponseSchema (features/places/detail.ts) so the client contract
// and this route cannot drift.
//
// Visibility is enforced in the repository — findPlaceBySlug() filters to
// PUBLIC_EXACT and PUBLIC_APPROXIMATE — so a private, moderator-only or
// community-restricted place is indistinguishable from one that does not exist:
// both answer 404. That is deliberate; this endpoint must not confirm that a
// hidden place exists.

import { NextRequest, NextResponse } from 'next/server';
import { placeService } from '@/features/places/services';
import { placeSlugSchema } from '@/lib/validation/schemas';
import { handleApiError, NotFoundError, rateLimiters } from '@/lib/security';

/** Route context, per the Next.js App Router handler signature. */
export interface PlaceDetailRouteContext {
  params: { slug: string };
}

export async function GET(request: NextRequest, { params }: PlaceDetailRouteContext) {
  try {
    // A detail lookup is a plain API read, not a search, so it uses the general
    // api limiter rather than the stricter search budget the list endpoints use.
    const rateLimitResult = await rateLimiters.api(request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Reject a malformed slug before touching the database. A path parameter is
    // not a query string, so it is validated directly rather than via
    // safeParse on a params object. A well-formed but unknown slug is a 404;
    // a malformed one is a 400, matching the sibling list routes.
    const parsedSlug = placeSlugSchema.safeParse(params.slug);
    if (!parsedSlug.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsedSlug.error.issues },
        { status: 400 }
      );
    }

    // placeService -> findPlaceBySlug(): one place query plus two batched
    // relation queries. No database query is duplicated in this route.
    const place = await placeService.getBySlug(parsedSlug.data);
    if (!place) {
      throw new NotFoundError('Place');
    }

    const response = NextResponse.json({ data: place });
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
