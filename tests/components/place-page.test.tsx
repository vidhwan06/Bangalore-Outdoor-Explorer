/** @jest-environment jsdom */
// Tests for the /places/[slug] server page: valid details, not-found handling,
// origin distance and metadata generation. Synthetic fixtures only.

import { render, screen } from '@testing-library/react';
import PlacePage, { generateMetadata, type PlacePageProps } from '@/app/places/[slug]/page';
import { placeService } from '@/features/places/services';
import { makePlaceDetail } from '../fixtures/place-details';

jest.mock('@/features/places/services', () => ({
  placeService: { getBySlug: jest.fn() },
}));

const mockGetBySlug = placeService.getBySlug as jest.MockedFunction<typeof placeService.getBySlug>;

function pageProps(slug: string, searchParams?: PlacePageProps['searchParams']): PlacePageProps {
  return { params: { slug }, searchParams };
}

describe('/places/[slug] page', () => {
  beforeEach(() => {
    mockGetBySlug.mockReset();
  });

  it('renders a valid place through the service layer', async () => {
    mockGetBySlug.mockResolvedValue(makePlaceDetail());

    const element = await PlacePage(pageProps('test-peak'));
    render(element);

    expect(mockGetBySlug).toHaveBeenCalledWith('test-peak');
    expect(screen.getByRole('heading', { level: 1, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByText('Trek')).toBeInTheDocument();
    expect(screen.getByText('A synthetic description used only in tests.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/explore');
  });

  it('throws the not-found error for an unknown slug', async () => {
    mockGetBySlug.mockResolvedValue(null);

    await expect(PlacePage(pageProps('missing-place'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('rejects an invalid slug without touching the service', async () => {
    await expect(PlacePage(pageProps('NOT a slug!'))).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetBySlug).not.toHaveBeenCalled();
  });

  it('treats an unavailable place as not-found without exposing database errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetBySlug.mockRejectedValue(new Error('connect ECONNREFUSED pooler.example:5432'));

    await expect(PlacePage(pageProps('test-peak'))).rejects.toThrow('NEXT_NOT_FOUND');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('shows distance when a valid discovery origin is supplied', async () => {
    mockGetBySlug.mockResolvedValue(makePlaceDetail());

    const element = await PlacePage(pageProps('test-peak', { lat: '12.9716', lng: '77.5946' }));
    render(element);

    expect(screen.getByText(/from your search location/)).toBeInTheDocument();
  });

  it('omits distance when the origin is missing or invalid', async () => {
    mockGetBySlug.mockResolvedValue(makePlaceDetail());

    const element = await PlacePage(pageProps('test-peak', { lat: 'abc', lng: '77.5946' }));
    render(element);

    expect(screen.queryByText(/from your search location/)).not.toBeInTheDocument();
  });
});

describe('/places/[slug] metadata', () => {
  beforeEach(() => {
    mockGetBySlug.mockReset();
  });

  it('generates title and description from actual place data', async () => {
    mockGetBySlug.mockResolvedValue(makePlaceDetail());

    const metadata = await generateMetadata(pageProps('test-peak'));

    expect(metadata.title).toBe('Test Peak');
    expect(metadata.description).toBe('A synthetic description used only in tests.');
  });

  it('falls back to the short description when no long description exists', async () => {
    mockGetBySlug.mockResolvedValue(makePlaceDetail({ description: null }));

    const metadata = await generateMetadata(pageProps('test-peak'));

    expect(metadata.description).toBe('A steep climb above the city');
  });

  it('uses an honest fallback when no description exists at all', async () => {
    mockGetBySlug.mockResolvedValue(makePlaceDetail({ description: null, shortDescription: null }));

    const metadata = await generateMetadata(pageProps('test-peak'));

    expect(metadata.description).toBe(
      'View trek details for Test Peak on Bengaluru Outdoor Explorer.'
    );
  });

  it('returns not-found metadata for unknown slugs', async () => {
    mockGetBySlug.mockResolvedValue(null);

    expect(await generateMetadata(pageProps('missing-place'))).toEqual({
      title: 'Place not found',
    });
  });

  it('returns not-found metadata for invalid slugs without a service call', async () => {
    expect(await generateMetadata(pageProps('../etc/passwd'))).toEqual({
      title: 'Place not found',
    });

    expect(mockGetBySlug).not.toHaveBeenCalled();
  });
});
