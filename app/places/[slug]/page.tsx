// /places/[slug] — place details (Phase 2B)
// Server component: loads details through the existing service layer directly.
// No API endpoint is needed — nothing on this page is fetched from the client.

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { placeService } from '@/features/places/services';
import { PLACE_CATEGORY_LABELS, validateDiscoveryLocation } from '@/features/places/discovery';
import { placeSlugSchema } from '@/lib/validation/schemas';
import { calculateDistance, truncate } from '@/lib/utils';
import { PlaceDetails } from '@/components/places/PlaceDetails';

export interface PlacePageProps {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

/**
 * Loads a place for the details page.
 * Returns null (never throws) for invalid slugs, unknown slugs and
 * unavailable data — raw database errors are logged, not exposed.
 */
async function loadPlace(slug: string) {
  const parsedSlug = placeSlugSchema.safeParse(slug);
  if (!parsedSlug.success) return null;

  try {
    return await placeService.getBySlug(parsedSlug.data);
  } catch (error) {
    console.error('Failed to load place details:', error);
    return null;
  }
}

/** Reads the discovery origin (?lat=&lng=) when it is valid. */
function readOrigin(searchParams?: PlacePageProps['searchParams']) {
  const lat = searchParams?.lat;
  const lng = searchParams?.lng;
  if (typeof lat !== 'string' || typeof lng !== 'string') return null;

  const validated = validateDiscoveryLocation({ latitude: lat, longitude: lng });
  return validated.valid ? { latitude: validated.latitude, longitude: validated.longitude } : null;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const place = await loadPlace(params.slug);
  if (!place) {
    return { title: 'Place not found' };
  }

  const summary = (place.description ?? place.shortDescription ?? '').trim();
  const categoryLabel = PLACE_CATEGORY_LABELS[place.category];

  return {
    title: place.name,
    description: summary
      ? truncate(summary, 160)
      : `View ${categoryLabel.toLowerCase()} details for ${place.name} on Bengaluru Outdoor Explorer.`,
  };
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const place = await loadPlace(params.slug);
  if (!place) notFound();

  const origin = readOrigin(searchParams);
  const distanceMeters = origin
    ? Math.round(
        calculateDistance(place.latitude, place.longitude, origin.latitude, origin.longitude)
      )
    : null;

  return <PlaceDetails place={place} distanceMeters={distanceMeters} />;
}
