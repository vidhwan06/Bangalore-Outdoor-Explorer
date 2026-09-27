// Featured Places
import { PlaceCard } from '@/components/places/PlaceCard';
import Link from 'next/link';

const featuredPlaces = [
  {
    id: '1',
    name: 'Nandi Hills',
    slug: 'nandi-hills',
    shortDescription: 'Iconic sunrise viewpoint with historic fort ruins',
    category: 'VIEWPOINT' as const,
    latitude: 13.3709,
    longitude: 77.6826,
    difficulty: 2,
    trailDistanceKm: 4.5,
    status: 'OPEN' as const,
    trustScore: 95,
    trustLevel: 'VERIFIED' as const,
    hasParking: true,
    hasWater: true,
    hasNetwork: true,
    permitRequired: false,
    primaryPhotoUrl: null,
    distanceKm: 40,
  },
  {
    id: '2',
    name: 'Skandagiri Night Trek',
    slug: 'skandagiri-night-trek',
    shortDescription: 'Popular night trek with stunning sunrise views',
    category: 'TREK' as const,
    latitude: 13.3267,
    longitude: 77.6194,
    difficulty: 3,
    trailDistanceKm: 8,
    status: 'PERMIT_REQUIRED' as const,
    trustScore: 88,
    trustLevel: 'VERIFIED' as const,
    hasParking: true,
    hasWater: false,
    hasNetwork: true,
    permitRequired: true,
    primaryPhotoUrl: null,
    distanceKm: 55,
  },
  {
    id: '3',
    name: 'Chunchi Falls',
    slug: 'chunchi-falls',
    shortDescription: 'Scenic waterfall near Kanakapura, best post-monsoon',
    category: 'WATERFALL' as const,
    latitude: 12.4407,
    longitude: 77.4167,
    difficulty: 2,
    trailDistanceKm: 2,
    status: 'OPEN' as const,
    trustScore: 82,
    trustLevel: 'COMMUNITY_SUBMITTED' as const,
    hasParking: true,
    hasWater: true,
    hasNetwork: false,
    permitRequired: false,
    primaryPhotoUrl: null,
    distanceKm: 65,
  },
  {
    id: '4',
    name: 'Savandurga Hill',
    slug: 'savandurga-hill',
    shortDescription: "Asia's largest monolith hill with temple & fort",
    category: 'MOUNTAIN' as const,
    latitude: 12.9167,
    longitude: 77.2833,
    difficulty: 4,
    trailDistanceKm: 6,
    status: 'OPEN' as const,
    trustScore: 90,
    trustLevel: 'VERIFIED' as const,
    hasParking: true,
    hasWater: false,
    hasNetwork: true,
    permitRequired: false,
    primaryPhotoUrl: null,
    distanceKm: 50,
  },
];

export function FeaturedPlaces() {
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
          {featuredPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
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
