/** @jest-environment jsdom */
// Component tests for the discovery place card

import { render, screen } from '@testing-library/react';
import { NearbyPlaceCard } from '@/components/explore/NearbyPlaceCard';
import { makeNearbyPlace } from '../fixtures/nearby-places';

describe('NearbyPlaceCard', () => {
  it('renders the fields returned by the nearby API', () => {
    render(<NearbyPlaceCard place={makeNearbyPlace()} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByText('Trek')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('A steep climb above the city')).toBeInTheDocument();
    expect(screen.getByText('1.2 km away')).toBeInTheDocument();
    expect(screen.getByText('3/5 · Challenging')).toBeInTheDocument();
    expect(screen.getByText('Verified source')).toBeInTheDocument();
  });

  it('renders community-submitted trust and permit status', () => {
    render(
      <NearbyPlaceCard
        place={makeNearbyPlace({
          trustLevel: 'COMMUNITY_SUBMITTED',
          status: 'PERMIT_REQUIRED',
        })}
      />
    );

    expect(screen.getByText('Community submitted')).toBeInTheDocument();
    expect(screen.getByText('Permit required')).toBeInTheDocument();
  });

  it('flags approximate locations', () => {
    render(<NearbyPlaceCard place={makeNearbyPlace({ visibilityLevel: 'PUBLIC_APPROXIMATE' })} />);

    expect(screen.getByText('Location shown approximately')).toBeInTheDocument();
  });

  it('handles places without a description or difficulty', () => {
    render(
      <NearbyPlaceCard place={makeNearbyPlace({ shortDescription: null, difficulty: null })} />
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.queryByText(/Challenging/)).not.toBeInTheDocument();
  });

  it('renders sub-kilometre distances in metres', () => {
    render(<NearbyPlaceCard place={makeNearbyPlace({ distanceMeters: 800 })} />);

    expect(screen.getByText('800 m away')).toBeInTheDocument();
  });

  it('links the place name to its details page', () => {
    render(<NearbyPlaceCard place={makeNearbyPlace()} />);

    const link = screen.getByRole('link', { name: 'Test Peak' });
    expect(link).toHaveAttribute('href', '/places/test-peak');
  });

  it('carries the search origin in the details link when available', () => {
    render(<NearbyPlaceCard place={makeNearbyPlace()} origin={{ lat: 12.9716, lng: 77.5946 }} />);

    expect(screen.getByRole('link', { name: 'Test Peak' })).toHaveAttribute(
      'href',
      '/places/test-peak?lat=12.9716&lng=77.5946'
    );
  });
});
