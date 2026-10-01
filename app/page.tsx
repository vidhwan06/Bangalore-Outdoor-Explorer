// Homepage - Server Component (force dynamic to avoid static generation with DB calls)
import { Metadata } from 'next';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryExplorer } from '@/components/home/CategoryExplorer';
import { FeaturedPlaces } from '@/components/home/FeaturedPlaces';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { CTASection } from '@/components/home/CTASection';
import { placeService } from '@/features/places/services';

export const metadata: Metadata = {
  title: 'Bengaluru Outdoor Explorer',
  description:
    'The living outdoor map of Bengaluru. Discover treks, waterfalls, lakes, forts, and hidden gems within 150km of Bengaluru. Everything you need before you leave.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const featuredResult = await placeService.getFeaturedPlaces(8);

  return (
    <main className="min-h-screen">
      <HeroSection />
      <CategoryExplorer />
      <FeaturedPlaces places={featuredResult.data} />
      <WhyChooseUs />
      <CTASection />
    </main>
  );
}
