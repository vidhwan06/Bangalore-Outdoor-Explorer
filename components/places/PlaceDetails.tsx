// Place details presentation — renders only fields the backend actually provides.
// No facilities, fees, hours, photos, ratings or coordinates are invented here.

import Link from 'next/link';
import { cn, formatDistance } from '@/lib/utils';
import {
  DIFFICULTY_LABELS,
  PLACE_CATEGORY_ICONS,
  PLACE_CATEGORY_LABELS,
} from '@/features/places/discovery';
import { toMapPlacePoint } from '@/features/places/map-places';
import type { PlaceDetailResult } from '@/features/places/repositories';
import { PlaceMap } from '@/components/map/PlaceMap';

const STATUS_LABELS: Record<PlaceDetailResult['status'], string> = {
  OPEN: 'Open',
  PERMIT_REQUIRED: 'Permit required',
  LIMITED_SLOTS: 'Limited slots',
  CLOSED: 'Closed',
  WEATHER_CONCERN: 'Weather concern',
  UNVERIFIED: 'Unverified',
};

const STATUS_CLASSES: Record<PlaceDetailResult['status'], string> = {
  OPEN: 'status-open',
  PERMIT_REQUIRED: 'status-permit_required',
  LIMITED_SLOTS: 'status-limited_slots',
  CLOSED: 'status-closed',
  WEATHER_CONCERN: 'status-weather_concern',
  UNVERIFIED: 'status-unverified',
};

const TRUST_LABELS: Record<PlaceDetailResult['trustLevel'], string> = {
  VERIFIED: 'Verified source',
  COMMUNITY_SUBMITTED: 'Community submitted',
  INFORMATION_OUTDATED: 'Information outdated',
  CLOSED_RESTRICTED: 'Closed / restricted',
  UNDER_REVIEW: 'Under review',
};

const TRUST_CLASSES: Record<PlaceDetailResult['trustLevel'], string> = {
  VERIFIED: 'trust-verified',
  COMMUNITY_SUBMITTED: 'trust-community_submitted',
  INFORMATION_OUTDATED: 'trust-information_outdated',
  CLOSED_RESTRICTED: 'trust-closed_restricted',
  UNDER_REVIEW: 'trust-under_review',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  OFFICIAL_GOVERNMENT: 'Official government',
  OFFICIAL_PARK_AUTHORITY: 'Official park authority',
  OFFICIAL_TOURISM_BOARD: 'Official tourism board',
  VERIFIED_CONTRIBUTOR: 'Verified contributor',
  COMMUNITY_REPORT: 'Community report',
  SATELLITE_IMAGERY: 'Satellite imagery',
  USER_VISIT: 'User visit',
  THIRD_PARTY_API: 'Third-party data',
};

export interface PlaceDetailsProps {
  place: PlaceDetailResult;
  /** Distance from the user's discovery location, when that origin is known. */
  distanceMeters?: number | null;
}

export function PlaceDetails({ place, distanceMeters }: PlaceDetailsProps) {
  const approximate = place.visibilityLevel === 'PUBLIC_APPROXIMATE';
  const description = (place.description ?? place.shortDescription ?? '').trim();
  const hasDistance = typeof distanceMeters === 'number' && Number.isFinite(distanceMeters);

  // Privacy-resolved location: exact coordinates only for PUBLIC_EXACT,
  // a coarse point for PUBLIC_APPROXIMATE, no map at all otherwise.
  const mapPlace = toMapPlacePoint({
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    visibilityLevel: place.visibilityLevel,
  });
  const mapLocation = mapPlace.location;

  return (
    <main className="min-h-screen">
      <nav
        aria-label="Breadcrumb"
        className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
      >
        <ol className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
          <li>
            <Link
              href="/explore"
              className="text-primary-600 hover:underline dark:text-primary-400"
            >
              Explore
            </Link>
          </li>
          <li aria-hidden="true" className="text-surface-400">
            /
          </li>
          <li aria-current="page" className="truncate text-surface-600 dark:text-surface-400">
            {place.name}
          </li>
        </ol>
      </nav>

      <article className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="card p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-primary text-xs">
              <span aria-hidden="true">{PLACE_CATEGORY_ICONS[place.category]}</span>
              {PLACE_CATEGORY_LABELS[place.category]}
            </span>
            <span className={cn('badge text-xs', STATUS_CLASSES[place.status])}>
              {STATUS_LABELS[place.status]}
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

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50">
            {place.name}
          </h1>

          {description ? (
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-surface-600 dark:text-surface-400">
              {description}
            </p>
          ) : (
            <p className="mt-4 text-sm text-surface-500 dark:text-surface-400">
              Description not available yet.
            </p>
          )}

          <dl className="border-border mt-6 grid gap-x-6 gap-y-4 border-t pt-6 sm:grid-cols-2">
            {hasDistance && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-surface-500 dark:text-surface-400">
                  Distance
                </dt>
                <dd className="mt-1 text-sm text-surface-900 dark:text-surface-50">
                  {formatDistance(distanceMeters)} from your search location
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-surface-500 dark:text-surface-400">
                Trust
              </dt>
              <dd className="mt-1">
                <span
                  className={cn('badge text-xs', TRUST_CLASSES[place.trustLevel])}
                  title="How much this entry can be trusted"
                >
                  {TRUST_LABELS[place.trustLevel]}
                </span>
              </dd>
            </div>
          </dl>

          {approximate && (
            <p className="mt-6 rounded-lg border-l-4 border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100">
              Approximate location — the exact coordinates of this place are not published.
            </p>
          )}

          {place.sources.length > 0 && (
            <section aria-label="Sources" className="border-border mt-6 border-t pt-6">
              <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                Sources
              </h2>
              <ul className="mt-2 space-y-1.5">
                {place.sources.map((source) => (
                  <li key={source.id} className="text-sm text-surface-600 dark:text-surface-400">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline dark:text-primary-400"
                      >
                        {source.name}
                      </a>
                    ) : (
                      <span>{source.name}</span>
                    )}
                    <span className="text-xs text-surface-500 dark:text-surface-400">
                      {' '}
                      · {SOURCE_TYPE_LABELS[source.type] ?? source.type}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Location panel: map view of this destination (2C.2 adds viewport sync) */}
        <aside aria-label="Map" className="mt-6">
          {mapLocation.kind === 'unavailable' ? (
            <div className="card flex min-h-[16rem] flex-col items-center justify-center p-6 text-center">
              <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                Location not available
              </p>
              <p className="mt-1 max-w-sm text-sm text-surface-500 dark:text-surface-400">
                A map location for this destination is not published.
              </p>
            </div>
          ) : (
            <PlaceMap
              places={[mapPlace]}
              center={{ latitude: mapLocation.latitude, longitude: mapLocation.longitude }}
              zoom={mapLocation.kind === 'approximate' ? 12 : 13}
              selectedPlaceId={mapPlace.id}
              height="20rem"
            />
          )}
        </aside>
      </article>
    </main>
  );
}
