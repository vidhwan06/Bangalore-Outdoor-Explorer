// Homepage - Server Component (force dynamic to avoid static generation with DB calls)
import { Metadata } from 'next';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryExplorer } from '@/components/home/CategoryExplorer';
import { FeaturedPlaces } from '@/components/home/FeaturedPlaces';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { CTASection } from '@/components/home/CTASection';
import { placeService } from '@/features/places/services';
import type { NearbyPlace } from '@/features/places/nearby';

export const metadata: Metadata = {
  title: 'Bengaluru Outdoor Explorer',
  description:
    'The living outdoor map of Bengaluru. Discover treks, waterfalls, hills, forts, and hidden gems within 50 km of Bengaluru. Structured data, verified sources, and map-first exploration.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // The homepage must stay renderable when the database is unavailable:
  // load featured places and category counts defensively and fall back to empty state.
  let featuredPlaces: NearbyPlace[] = [];
  let categoryCounts: Record<string, number> = {};
  try {
    const [featuredResult, counts] = await Promise.all([
      placeService.getFeaturedPlaces(8),
      placeService.getCategoryCounts(),
    ]);
    featuredPlaces = featuredResult.data;
    categoryCounts = counts;
  } catch (error) {
    console.error('Failed to load homepage data:', error);
  }

  return (
    <main className="min-h-screen">
      <HeroSection />
      <CategoryExplorer categoryCounts={categoryCounts} />
      <FeaturedPlaces places={featuredPlaces} />
      <WhyChooseUs />
      <CTASection />
    </main>
  );
}
