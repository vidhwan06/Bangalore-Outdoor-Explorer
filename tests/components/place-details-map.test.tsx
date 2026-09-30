/** @jest-environment jsdom */
// Verifies /places/[slug] renders the map with the actual place data while
// preserving privacy behaviour for approximate/missing locations.

import { render, screen } from '@testing-library/react';
import { PlaceDetails } from '@/components/places/PlaceDetails';
import type { PlaceDetailResult } from '@/features/places/repositories';
import { makePlaceDetail } from '../fixtures/place-details';

describe('PlaceDetails map integration', () => {
  it('renders the map with the actual place for a PUBLIC_EXACT place', async () => {
    render(<PlaceDetails place={makePlaceDetail()} />);

    expect(screen.getByRole('complementary', { name: 'Map' })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Interactive map' })).toBeInTheDocument();

    // Exact place: marker carries the plain name (no approximation label)
    const marker = await screen.findByLabelText('Test Peak');
    expect(marker).toHaveClass('place-map-marker');
    expect(marker).not.toHaveClass('place-map-marker--approximate');
    expect(marker).toHaveAttribute('aria-pressed', 'true');
  });

  it('plots PUBLIC_APPROXIMATE places only as an approximate marker', async () => {
    render(<PlaceDetails place={makePlaceDetail({ visibilityLevel: 'PUBLIC_APPROXIMATE' })} />);

    const marker = await screen.findByLabelText('Test Peak (approximate location)');
    expect(marker).toHaveClass('place-map-marker--approximate');

    // The privacy explanation from Phase 2B is still shown
    expect(screen.getByText(/Approximate location/)).toBeInTheDocument();
  });

  it('shows a location-unavailable state instead of a map when coordinates are missing', () => {
    const placeWithoutCoordinates = makePlaceDetail({
      latitude: null as unknown as number,
      longitude: null as unknown as number,
    });

    render(<PlaceDetails place={placeWithoutCoordinates} />);

    expect(screen.getByText('Location not available')).toBeInTheDocument();
    expect(screen.getByText(/not published/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Interactive map' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
