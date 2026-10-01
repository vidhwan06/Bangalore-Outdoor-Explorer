// Featured Places
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
              Popular This Week
            </h2>
            <p className="mt-2 text-lg text-surface-600 dark:text-surface-400">
              Trending destinations based on recent visits & community activity
            </p>
          </div>
          <Link
            href="/explore?sort=popularity"
            className="btn-outline hidden items-center gap-2 sm:inline-flex"
          >
            View All
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} variant="featured" />
          ))}
        </div>

        <div className="animate-in mt-8 text-center sm:hidden">
          <Link
            href="/explore?sort=popularity"
            className="btn-outline inline-flex items-center gap-2"
          >
            View All
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
