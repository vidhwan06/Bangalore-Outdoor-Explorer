// Integration test for the real rate limiter in front of the Places API.
//
// tests/integration/api-places-nearby-db.test.ts replaces the search limiter so a
// long database-backed suite is not throttled by the shared in-process bucket.
// This file keeps the real limiter, so the 429 contract is verified end to end:
// the request must be rejected before any database work happens, and the
// response must carry a Retry-After hint.

import { NextRequest } from 'next/server';
import { GET as nearbyGET } from '@/app/api/places/nearby/route';
import { rateLimiters } from '@/lib/security';

// The limiter's window is 60s at 30 requests/minute. Each test consumes one
// shared bucket, so they must not overlap.
jest.setTimeout(60_000);

const BENGALURU = { lat: 12.9716, lng: 77.5946 } as const;

/** The search limiter's configured budget, from rateLimiters.search. */
const MAX_REQUESTS = 30;

function nearbyRequest(): NextRequest {
  const params = new URLSearchParams();
  params.set('lat', String(BENGALURU.lat));
  params.set('lng', String(BENGALURU.lng));
  params.set('radius', '5000');
  return new NextRequest(`http://localhost/api/places/nearby?${params.toString()}`);
}

function headersOf(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

describe('Places API rate limiting (real limiter)', () => {
  it('allows requests up to the budget, then returns 429', async () => {
    const statuses: number[] = [];

    // One extra request past the budget to observe the transition.
    for (let i = 0; i < MAX_REQUESTS + 1; i++) {
      const response = await nearbyGET(nearbyRequest());
      statuses.push(response.status);
    }

    const allowed = statuses.filter((status) => status === 200);
    const limited = statuses.filter((status) => status === 429);

    expect(allowed.length).toBe(MAX_REQUESTS);
    expect(limited.length).toBe(1);
    // The limit must kick in only once the budget is spent.
    expect(statuses[MAX_REQUESTS - 1]).toBe(200);
    expect(statuses[MAX_REQUESTS]).toBe(429);
  });

  it('returns a 429 body with a code and a Retry-After header', async () => {
    // Drain the remaining budget; the previous test may have left a partial
    // window, so loop until throttled.
    let response = await nearbyGET(nearbyRequest());
    for (let i = 0; i < MAX_REQUESTS + 1 && response.status !== 429; i++) {
      response = await nearbyGET(nearbyRequest());
    }

    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    // An error body must not carry partial results.
    expect(body.data).toBeUndefined();

    const headers = headersOf(response);
    expect(headers['retry-after']).toBeDefined();
    expect(Number(headers['retry-after'])).toBeGreaterThan(0);
    expect(headers['x-ratelimit-remaining']).toBe('0');
  });

  it('applies to the bounds endpoint too, since it shares the search limiter', async () => {
    const params = new URLSearchParams();
    params.set('north', '13.2');
    params.set('south', '12.8');
    params.set('east', '77.8');
    params.set('west', '77.2');
    const request = () =>
      new NextRequest(`http://localhost/api/places/bounds?${params.toString()}`);

    let response = await boundsGETShim(request());
    for (let i = 0; i < MAX_REQUESTS + 1 && response.status !== 429; i++) {
      response = await boundsGETShim(request());
    }

    expect(response.status).toBe(429);
  });
});

// Imported lazily so the module registry is shared with the route above but the
// symbol stays readable at the call site.
async function boundsGETShim(request: NextRequest): Promise<Response> {
  const { GET } = await import('@/app/api/places/bounds/route');
  return GET(request);
}
