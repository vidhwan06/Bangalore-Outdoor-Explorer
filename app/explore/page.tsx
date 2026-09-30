// /explore — outdoor discovery page (Phase 2A)
// Server component: handles metadata and URL params, delegates to the client container.

import { Metadata } from 'next';
import { ExploreDiscovery } from '@/components/explore/ExploreDiscovery';
import { placeCategorySchema, type PlaceCategory } from '@/lib/validation/schemas';

export const metadata: Metadata = {
  title: 'Explore',
  description:
    'Discover treks, hills, waterfalls, lakes and hidden gems around Bengaluru. Search outdoor places by location, radius, category and difficulty.',
};

interface ExplorePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

/** Reads /explore?category=trek style params from the homepage links. */
function readInitialCategory(raw: string | string[] | undefined): PlaceCategory | undefined {
  if (typeof raw !== 'string') return undefined;
  const parsed = placeCategorySchema.safeParse(raw.toUpperCase());
  return parsed.success ? parsed.data : undefined;
}

export default function ExplorePage({ searchParams }: ExplorePageProps) {
  return <ExploreDiscovery initialCategory={readInitialCategory(searchParams.category)} />;
}
