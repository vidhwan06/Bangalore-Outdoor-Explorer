// Place card for discovery results.
// Renders only fields the /api/places/nearby endpoint actually returns
// and links each result to its details page.

import Link from 'next/link';
import { cn, formatDistance } from '@/lib/utils';
import {
  DIFFICULTY_LABELS,
  PLACE_CATEGORY_ICONS,
  PLACE_CATEGORY_LABELS,
} from '@/features/places/discovery';
import type { NearbyPlace } from '@/features/places/nearby';

const STATUS_LABELS: Record<NearbyPlace['status'], string> = {
  OPEN: 'Open',
  PERMIT_REQUIRED: 'Permit required',
  LIMITED_SLOTS: 'Limited slots',
  CLOSED: 'Closed',
  WEATHER_CONCERN: 'Weather concern',
  UNVERIFIED: 'Unverified',
};

const STATUS_CLASSES: Record<NearbyPlace['status'], string> = {
  OPEN: 'status-open',
  PERMIT_REQUIRED: 'status-permit_required',
  LIMITED_SLOTS: 'status-limited_slots',
  CLOSED: 'status-closed',
  WEATHER_CONCERN: 'status-weather_concern',
  UNVERIFIED: 'status-unverified',
};

const TRUST_LABELS: Record<NearbyPlace['trustLevel'], string> = {
  VERIFIED: 'Verified source',
  COMMUNITY_SUBMITTED: 'Community submitted',
  INFORMATION_OUTDATED: 'Information outdated',
  CLOSED_RESTRICTED: 'Closed / restricted',
  UNDER_REVIEW: 'Under review',
};

const TRUST_CLASSES: Record<NearbyPlace['trustLevel'], string> = {
  VERIFIED: 'trust-verified',
  COMMUNITY_SUBMITTED: 'trust-community_submitted',
  INFORMATION_OUTDATED: 'trust-information_outdated',
  CLOSED_RESTRICTED: 'trust-closed_restricted',
  UNDER_REVIEW: 'trust-under_review',
};

/** Discovery search origin — carried into the details page for distance context. */
export interface DiscoveryOrigin {
  lat: number;
  lng: number;
}

/** Builds the details-page href for a search result. */
export function buildPlaceHref(slug: string, origin?: DiscoveryOrigin | null): string {
  const base = `/places/${slug}`;
  if (!origin) return base;
  const params = new URLSearchParams();
  params.set('lat', String(origin.lat));
  params.set('lng', String(origin.lng));
  return `${base}?${params.toString()}`;
}

export interface NearbyPlaceCardProps {
  place: NearbyPlace;
  origin?: DiscoveryOrigin | null;
}

export function NearbyPlaceCard({ place, origin }: NearbyPlaceCardProps) {
  const approximate = place.visibilityLevel === 'PUBLIC_APPROXIMATE';

  return (
    <article className="card p-4" aria-label={place.name}>
      <div className="flex items-start justify-between gap-3">
        <span className="badge-primary truncate text-xs">
          <span aria-hidden="true">{PLACE_CATEGORY_ICONS[place.category]}</span>
          {PLACE_CATEGORY_LABELS[place.category]}
        </span>
        <span className={cn('badge shrink-0 text-xs', STATUS_CLASSES[place.status])}>
          {STATUS_LABELS[place.status]}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-surface-900 dark:text-surface-50">
        <Link
          href={buildPlaceHref(place.slug, origin)}
          className="transition-colors hover:text-primary-600 dark:hover:text-primary-400"
        >
          {place.name}
        </Link>
      </h3>

      {place.shortDescription && (
        <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
          {place.shortDescription}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
        <span title="Distance from your starting point">
          {formatDistance(place.distanceMeters)} away
        </span>
        {place.difficulty !== null && (
          <span
            className={cn('badge difficulty-' + place.difficulty)}
            title={`Difficulty ${place.difficulty} of 5`}
          >
            {place.difficulty}/5 · {DIFFICULTY_LABELS[place.difficulty] ?? 'Unrated'}
          </span>
        )}
      </div>

      <div className="border-border mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span
          className={cn('badge text-xs', TRUST_CLASSES[place.trustLevel])}
          title="How much this entry can be trusted"
        >
          {TRUST_LABELS[place.trustLevel]}
        </span>
        {approximate && (
          <span className="text-xs text-surface-500 dark:text-surface-400">
            Location shown approximately
          </span>
        )}
      </div>
    </article>
  );
}
