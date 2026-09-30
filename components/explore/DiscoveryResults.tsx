// Results area for the discovery page — initial, loading, results,
// empty and error states for GET /api/places/nearby.

import { formatRadius } from '@/features/places/discovery';
import type { NearbyPlace } from '@/features/places/nearby';
import { NearbyPlaceCard, type DiscoveryOrigin } from './NearbyPlaceCard';

export type DiscoveryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DiscoveryResultsProps {
  status: DiscoveryStatus;
  places: NearbyPlace[];
  /** Total matches reported by the API (may exceed places.length). */
  totalCount: number | null;
  radiusMeters: number;
  /** Last successful search origin — carried into place detail links. */
  origin?: DiscoveryOrigin | null;
  errorMessage?: string | null;
  onRetry: () => void;
}

function SkeletonCard() {
  return (
    <li className="card space-y-3 p-4" aria-hidden="true">
      <div className="skeleton h-4 w-20" />
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-1/2" />
    </li>
  );
}

function LoadingState() {
  return (
    <div role="status" className="card p-6">
      <p className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
        <svg
          className="h-4 w-4 animate-spin text-primary-600"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Searching for outdoor places…
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ul>
    </div>
  );
}

function IdleState() {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
        Ready when you are
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-surface-600 dark:text-surface-400">
        Set a starting point and radius above, then choose <strong>Search places</strong> to find
        outdoor destinations nearby.
      </p>
    </div>
  );
}

function ErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="card border-red-300 p-8 text-center dark:border-red-800">
      <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Search failed</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-surface-600 dark:text-surface-400">
        {errorMessage}
      </p>
      <button type="button" className="btn-primary mt-4" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
        No places found in this area
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-surface-600 dark:text-surface-400">
        Try a wider radius, or clear the category and difficulty filters. Destinations are added as
        they are verified, so coverage grows over time.
      </p>
    </div>
  );
}

export function DiscoveryResults({
  status,
  places,
  totalCount,
  radiusMeters,
  origin,
  errorMessage,
  onRetry,
}: DiscoveryResultsProps) {
  const count = totalCount ?? places.length;

  return (
    <section aria-label="Search results" aria-live="polite" className="min-w-0">
      {status === 'idle' && <IdleState />}
      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState errorMessage={errorMessage ?? null} onRetry={onRetry} />}
      {status === 'success' && places.length === 0 && <EmptyState />}
      {status === 'success' && places.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
              {count} {count === 1 ? 'place' : 'places'} within {formatRadius(radiusMeters)}
            </h2>
            {count > places.length && (
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Showing the {places.length} closest
              </p>
            )}
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {places.map((place) => (
              <li key={place.id}>
                <NearbyPlaceCard place={place} origin={origin} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
