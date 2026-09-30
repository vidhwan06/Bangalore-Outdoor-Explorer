// Place Card Component
import Link from 'next/link';
import { place_category, place_status, trust_level } from '@prisma/client';
import { cn, formatDistance, getInitials } from '@/lib/utils';

interface PlaceCardProps {
  place: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    category: place_category;
    latitude: number;
    longitude: number;
    difficulty: number | null;
    trailDistanceKm: number | null;
    status: place_status;
    trustScore: number;
    trustLevel: trust_level;
    hasParking: boolean;
    hasWater: boolean;
    hasNetwork: boolean;
    permitRequired: boolean;
    primaryPhotoUrl: string | null;
    distanceKm?: number;
  };
  variant?: 'default' | 'compact' | 'featured';
}

const categoryLabels: Record<place_category, string> = {
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

const categoryIcons: Record<place_category, string> = {
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

export function PlaceCard({ place, variant = 'default' }: PlaceCardProps) {
  const isCompact = variant === 'compact';
  const isFeatured = variant === 'featured';

  return (
    <article
      className={cn(
        'card-interactive group overflow-hidden',
        isCompact && 'flex flex-row gap-4 p-3',
        isFeatured && 'flex flex-col'
      )}
    >
      <Link
        href={`/places/${place.slug}`}
        className={cn(
          'block overflow-hidden',
          isCompact && 'h-24 w-24 flex-shrink-0 rounded-lg',
          !isCompact && 'aspect-[4/3]'
        )}
        aria-label={`View ${place.name}`}
      >
        {place.primaryPhotoUrl ? (
          <img
            src={place.primaryPhotoUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50 text-4xl dark:from-primary-900/30 dark:to-primary-900/10">
            {categoryIcons[place.category]}
          </div>
        )}
      </Link>

      <div
        className={cn(
          'flex flex-col p-4',
          isCompact && 'min-w-0 flex-1 justify-center',
          !isCompact && 'flex-1'
        )}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg">{categoryIcons[place.category]}</span>
            <span
              className={cn(
                'badge-primary truncate text-xs font-medium',
                `category-${place.category.toLowerCase()}`
              )}
            >
              {categoryLabels[place.category]}
            </span>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5">
            {place.permitRequired && (
              <span className="badge-warning text-xs" title="Permit required">
                🎫
              </span>
            )}
            <span
              className={cn(
                'badge text-xs',
                place.status === 'OPEN' && 'status-open',
                place.status === 'PERMIT_REQUIRED' && 'status-permit_required',
                place.status === 'LIMITED_SLOTS' && 'status-limited_slots',
                place.status === 'CLOSED' && 'status-closed',
                place.status === 'WEATHER_CONCERN' && 'status-weather_concern',
                place.status === 'UNVERIFIED' && 'status-unverified'
              )}
            >
              {place.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <Link href={`/places/${place.slug}`} className="group">
          <h3
            className={cn(
              'group-hover:text-primary line-clamp-1 font-semibold text-surface-900 transition-colors dark:text-surface-500 dark:group-hover:text-primary-400',
              isCompact && 'text-base',
              !isCompact && 'text-lg'
            )}
          >
            {place.name}
          </h3>
        </Link>

        {place.shortDescription && !isCompact && (
          <p className="mt-1 line-clamp-2 flex-1 text-sm text-surface-600 dark:text-surface-400">
            {place.shortDescription}
          </p>
        )}

        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-3 text-xs text-surface-500 dark:text-surface-400',
            isCompact && 'mt-2 gap-2'
          )}
        >
          {place.distanceKm && (
            <span className="flex items-center gap-1" title="Distance from Bengaluru">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
              {formatDistance(place.distanceKm * 1000)}
            </span>
          )}

          {place.difficulty && (
            <span
              className={cn('badge difficulty-' + place.difficulty, 'flex items-center gap-1')}
              title={`Difficulty: ${place.difficulty}/5`}
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {place.difficulty}/5
            </span>
          )}

          {place.trailDistanceKm && (
            <span className="flex items-center gap-1" title="Trail distance">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 15l3-3m0 0l3 3m-3-3v12"
                />
              </svg>
              {place.trailDistanceKm}km
            </span>
          )}
        </div>

        {!isCompact && (
          <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
              {place.hasParking && (
                <span className="flex items-center gap-1" title="Parking available">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                    />
                  </svg>
                </span>
              )}
              {place.hasWater && (
                <span className="flex items-center gap-1" title="Water available">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </span>
              )}
              {place.hasNetwork && (
                <span className="flex items-center gap-1" title="Network available">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'badge text-xs',
                  place.trustLevel === 'VERIFIED' && 'trust-verified',
                  place.trustLevel === 'COMMUNITY_SUBMITTED' && 'trust-community_submitted',
                  place.trustLevel === 'INFORMATION_OUTDATED' && 'trust-information_outdated',
                  place.trustLevel === 'CLOSED_RESTRICTED' && 'trust-closed_restricted',
                  place.trustLevel === 'UNDER_REVIEW' && 'trust-under_review'
                )}
              >
                {place.trustLevel.replace('_', ' ')}
              </span>
              <span className="font-mono text-xs text-surface-400 dark:text-surface-500">
                {place.trustScore}/100
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
