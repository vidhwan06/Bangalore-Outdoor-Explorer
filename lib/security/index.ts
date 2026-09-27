// Security utilities
// Rate limiting, input sanitization, validation helpers

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Rate limiting store (in-memory for dev, Redis for production)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string;
}

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = config;

  return async function rateLimitMiddleware(
    request: NextRequest,
    key?: string
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    headers: Record<string, string>;
  }> {
    const identifier = key || request.ip || 'anonymous';
    const fullKey = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    const entry = rateLimitStore.get(fullKey);

    if (!entry || now > entry.resetAt) {
      // New window
      const resetAt = now + windowMs;
      rateLimitStore.set(fullKey, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt,
        headers: {
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': (maxRequests - 1).toString(),
          'X-RateLimit-Reset': Math.ceil(resetAt / 1000).toString(),
        },
      };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        headers: {
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(entry.resetAt / 1000).toString(),
          'Retry-After': Math.ceil((entry.resetAt - now) / 1000).toString(),
        },
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
      headers: {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': Math.ceil(entry.resetAt / 1000).toString(),
      },
    };
  };
}

// Predefined rate limiters
export const rateLimiters = {
  api: rateLimit({ windowMs: 60_000, maxRequests: 100, keyPrefix: 'api' }), // 100/min
  auth: rateLimit({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'auth' }), // 10/min
  upload: rateLimit({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'upload' }), // 20/min
  search: rateLimit({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'search' }), // 30/min
  ai: rateLimit({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'ai' }), // 20/min
  submission: rateLimit({ windowMs: 3_600_000, maxRequests: 10, keyPrefix: 'submission' }), // 10/hour
};

// Input sanitization
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

export function sanitizeSqlInput(input: string): string {
  // Basic SQL injection prevention - use parameterized queries instead
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

// CSRF protection
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateCsrfToken(token: string, sessionToken: string): boolean {
  // In production, use constant-time comparison
  return token === sessionToken;
}

// Content Security Policy helpers
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'", 'https:', 'wss:'],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
};

export function generateCSPHeader(nonce?: string): string {
  const directives = { ...CSP_DIRECTIVES };

  if (nonce) {
    directives['script-src'] = ["'self'", `'nonce-${nonce}'`, "'unsafe-eval'"];
    directives['style-src'] = ["'self'", `'nonce-${nonce}'`];
  }

  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

// Security headers
export function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

// Validation helpers
export const validationSchemas = {
  // Coordinates
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),

  // Bounding box
  bounds: z
    .object({
      north: z.number().min(-90).max(90),
      south: z.number().min(-90).max(90),
      east: z.number().min(-180).max(180),
      west: z.number().min(-180).max(180),
    })
    .refine((b) => b.north > b.south && b.east > b.west, {
      message: 'Invalid bounds: north must be > south, east must be > west',
    }),

  // Pagination
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  }),

  // Date range
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),

  // Search query
  searchQuery: z.string().min(1).max(200).optional(),

  // ID (CUID)
  id: z.string().cuid(),

  // Slug
  slug: z
    .string()
    .min(1)
    .max(250)
    .regex(/^[a-z0-9-]+$/),

  // Email
  email: z.string().email(),

  // URL
  url: z.string().url(),
};

// Error classes
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class RateLimitError extends SecurityError {
  public resetAt: number;

  constructor(resetAt: number) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

export class ValidationError extends SecurityError {
  constructor(
    message: string,
    public issues: z.ZodIssue[]
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends SecurityError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_REQUIRED', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends SecurityError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_FAILED', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends SecurityError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

// Safe error handling for API routes
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  if (error instanceof SecurityError) {
    const headers: Record<string, string> = {};
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = Math.ceil((error.resetAt - Date.now()) / 1000).toString();
    }
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode, headers }
    );
  }

  // Log unexpected errors
  console.error('API Error:', error);

  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

// Request validation helper
export async function validateRequest<T>(request: NextRequest, schema: z.ZodSchema<T>): Promise<T> {
  const contentType = request.headers.get('content-type');

  let data: unknown;
  if (contentType?.includes('application/json')) {
    data = await request.json();
  } else if (contentType?.includes('multipart/form-data')) {
    const formData = await request.formData();
    data = Object.fromEntries(formData.entries());
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    data = Object.fromEntries(formData.entries());
  } else {
    data = await request.json().catch(() => ({}));
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Invalid request data', result.error.issues);
  }

  return result.data;
}
