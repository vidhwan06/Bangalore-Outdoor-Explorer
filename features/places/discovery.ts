// Discovery options and client-side input validation for the /explore experience.
// Shared by the discovery controls and results components.
// No database access here — this module only holds constants, labels and validation.

import { z } from 'zod';
import { placeCategorySchema, type PlaceCategory } from '@/lib/validation/schemas';

/** A plain option shape compatible with components/ui Select's `options` prop. */
export interface DiscoveryOption {
  value: string;
  label: string;
}

// -----------------------------------------
// Defaults & limits (mirror the API contract)
// -----------------------------------------

/** Bengaluru city centre — the default starting point for discovery. */
export const DEFAULT_SEARCH_CENTER = {
  latitude: 12.9716,
  longitude: 77.5946,
} as const;

export const DEFAULT_RADIUS_METERS = 10000;

/** GET /api/places/nearby rejects radii above 50km. */
export const MAX_RADIUS_METERS = 50000;

/** Requested page size for discovery results (API default is 20, max 100). */
export const SEARCH_RESULT_LIMIT = 20;

// -----------------------------------------
// Filter options
// -----------------------------------------

export const RADIUS_OPTIONS: DiscoveryOption[] = [
  { value: '5000', label: 'Within 5 km' },
  { value: '10000', label: 'Within 10 km' },
  { value: '25000', label: 'Within 25 km' },
  { value: '50000', label: 'Within 50 km' },
];

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  TREK: 'Trek',
  HIKE: 'Hike',
  WATERFALL: 'Waterfall',
  LAKE: 'Lake',
  MOUNTAIN: 'Mountain',
  FOREST: 'Forest',
  CAVE: 'Cave',
  FORT: 'Fort',
  VIEWPOINT: 'Viewpoint',
  CAMPING: 'Camping',
  CYCLING: 'Cycling',
  SCENIC_DRIVE: 'Scenic Drive',
  HIDDEN_GEM: 'Hidden Gem',
};

export const PLACE_CATEGORY_ICONS: Record<PlaceCategory, string> = {
  TREK: '🏔️',
  HIKE: '🥾',
  WATERFALL: '💧',
  LAKE: '🏞️',
  MOUNTAIN: '⛰️',
  FOREST: '🌲',
  CAVE: '🕳️',
  FORT: '🏰',
  VIEWPOINT: '🌄',
  CAMPING: '⛺',
  CYCLING: '🚴',
  SCENIC_DRIVE: '🛣️',
  HIDDEN_GEM: '✨',
};

const categoryValues = Object.keys(PLACE_CATEGORY_LABELS) as PlaceCategory[];

/** Select options for categories — first entry clears the filter. */
export const CATEGORY_OPTIONS: DiscoveryOption[] = [
  { value: '', label: 'All categories' },
  ...categoryValues.map((value) => ({ value, label: PLACE_CATEGORY_LABELS[value] })),
];

/** Difficulty labels for the 1–5 scale used by the schema. */
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Easy',
  2: 'Moderate',
  3: 'Challenging',
  4: 'Strenuous',
  5: 'Expert',
};

/** Select options for difficulty — first entry clears the filter. */
export const DIFFICULTY_OPTIONS: DiscoveryOption[] = [
  { value: '', label: 'Any difficulty' },
  ...Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({
    value,
    label: `${value} · ${label}`,
  })),
];

/** Human readable radius, e.g. 10000 -> "10 km". */
export function formatRadius(meters: number): string {
  return `${Math.round(meters / 1000)} km`;
}

// -----------------------------------------
// Filter parsing (one source of truth for API filters)
// -----------------------------------------

/** Raw category/difficulty strings as held by the discovery form. */
export interface DiscoveryFilterInput {
  category: string;
  difficulty: string;
}

export interface DiscoveryFilterValues {
  category?: PlaceCategory;
  difficulty?: number;
}

/**
 * Parses the active discovery form filters into API-ready values.
 * Shared by the radius search and the viewport (bounds) search so there is
 * exactly one source of truth for which filters apply to a request.
 * Invalid/empty selections resolve to `undefined` (filter not applied).
 */
export function parseFilterValues(input: DiscoveryFilterInput): DiscoveryFilterValues {
  const parsedCategory = placeCategorySchema.safeParse(input.category);
  const difficulty = input.difficulty === '' ? Number.NaN : Number(input.difficulty);

  return {
    category: parsedCategory.success ? parsedCategory.data : undefined,
    difficulty:
      Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5 ? difficulty : undefined,
  };
}

// -----------------------------------------
// Location input validation (Zod at the boundary)
// -----------------------------------------

const coordinateField = (label: string, min: number, max: number, required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .refine((value) => Number.isFinite(Number(value)), `${label} must be a number`)
    .refine(
      (value) => Number(value) >= min && Number(value) <= max,
      `${label} must be between ${min} and ${max}`
    );

const discoveryLocationSchema = z.object({
  latitude: coordinateField('Latitude', -90, 90, 'Latitude is required'),
  longitude: coordinateField('Longitude', -180, 180, 'Longitude is required'),
});

export interface DiscoveryLocationInput {
  latitude: string;
  longitude: string;
}

export type DiscoveryLocationResult =
  | { valid: true; latitude: number; longitude: number }
  | { valid: false; fieldErrors: { latitude?: string; longitude?: string } };

/**
 * Validates raw coordinate input before it is sent to the API.
 * Mirrors the server-side query schema so invalid input never reaches the network.
 */
export function validateDiscoveryLocation(input: DiscoveryLocationInput): DiscoveryLocationResult {
  const parsed = discoveryLocationSchema.safeParse(input);
  if (parsed.success) {
    return {
      valid: true,
      latitude: Number(parsed.data.latitude),
      longitude: Number(parsed.data.longitude),
    };
  }

  const fieldErrors: { latitude?: string; longitude?: string } = {};
  for (const issue of parsed.error.issues) {
    if (issue.path[0] === 'latitude' && !fieldErrors.latitude) {
      fieldErrors.latitude = issue.message;
    }
    if (issue.path[0] === 'longitude' && !fieldErrors.longitude) {
      fieldErrors.longitude = issue.message;
    }
  }
  return { valid: false, fieldErrors };
}
