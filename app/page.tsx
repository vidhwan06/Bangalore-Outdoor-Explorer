// Homepage - Server Component
import { Metadata } from 'next';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryExplorer } from '@/components/home/CategoryExplorer';
import { FeaturedPlaces } from '@/components/home/FeaturedPlaces';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { CTASection } from '@/components/home/CTASection';

export const metadata: Metadata = {
  title: 'Bengaluru Outdoor Explorer',
  description:
    'The living outdoor map of Bengaluru. Discover treks, waterfalls, lakes, forts, and hidden gems within 150km of Bengaluru. Everything you need before you leave.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <CategoryExplorer />
      <FeaturedPlaces />
      <WhyChooseUs />
      <CTASection />
    </main>
  );
}
