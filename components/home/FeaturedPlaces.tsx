// Featured Places — database-backed via placeService.getFeaturedPlaces()
// (OPEN destinations near Bengaluru, ordered by distance — no ranking).
import { PlaceCard } from '@/components/places/PlaceCard';
import Link from 'next/link';
import type { NearbyPlace } from '@/features/places/nearby';

interface FeaturedPlacesProps {
  places: NearbyPlace[];
}

export function FeaturedPlaces({ places }: FeaturedPlacesProps) {
  return (
    <section className="bg-surface-50 py-16 lg:py-24 dark:bg-surface-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-in mb-12 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-surface-50">
              Open Destinations Near Bengaluru
            </h2>
            <p className="mt-2 text-lg text-surface-600 dark:text-surface-400">
              Places currently marked open within 50 km of the city centre — closest first.
            </p>
          </div>
          <Link
            href="/explore"
            className="btn-outline hidden items-center gap-2 sm:inline-flex"
          >
            View All
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {places.length === 0 ? (
          // DB unavailable or no open places yet — never fabricate destinations.
          <div className="rounded-lg border border-surface-200 bg-white p-8 text-center dark:border-surface-700 dark:bg-surface-800/50">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Featured destinations are temporarily unavailable.
            </p>
            <Link href="/explore" className="btn-outline mt-4 inline-flex items-center gap-2">
              Explore all places
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={{ ...place, distanceKm: place.distanceMeters / 1000 }}
                variant="featured"
              />
            ))}
          </div>
        )}

        <div className="animate-in mt-8 text-center sm:hidden">
          <Link href="/explore" className="btn-outline inline-flex items-center gap-2">
            View All
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
