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
    'The living outdoor map of Bengaluru. Discover treks, waterfalls, lakes, forts, and hidden gems within 150km of Bengaluru. Everything you need before you leave.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // The homepage must stay renderable when the database is unavailable:
  // load featured places defensively and fall back to an empty state.
  let featuredPlaces: NearbyPlace[] = [];
  try {
    const featuredResult = await placeService.getFeaturedPlaces(8);
    featuredPlaces = featuredResult.data;
  } catch (error) {
    console.error('Failed to load featured places for homepage:', error);
  }

  return (
    <main className="min-h-screen">
      <HeroSection />
      <CategoryExplorer />
      <FeaturedPlaces places={featuredPlaces} />
      <WhyChooseUs />
      <CTASection />
    </main>
  );
}
