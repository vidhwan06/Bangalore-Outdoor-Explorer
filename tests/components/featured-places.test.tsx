/** @jest-environment jsdom */
// Tests for the homepage FeaturedPlaces section (database-backed destination
// cards): accurate copy, distance fidelity, real links, and the empty-state
// fallback used when the database is unavailable.

import { render, screen } from '@testing-library/react';
import { FeaturedPlaces } from '@/components/home/FeaturedPlaces';
import { makeNearbyPlace } from '../fixtures/nearby-places';

describe('FeaturedPlaces', () => {
  it('renders database-provided places with links to their detail pages', () => {
    render(
      <FeaturedPlaces
        places={[makeNearbyPlace({ id: '1', name: 'Nandi Hills', slug: 'nandi-hills' })]}
      />
    );

    expect(screen.getByText('Nandi Hills')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Nandi Hills' })).toHaveAttribute(
      'href',
      '/places/nandi-hills'
    );
  });

  it('converts the stored distance so the card distance chip displays', () => {
    render(
      <FeaturedPlaces
        places={[makeNearbyPlace({ id: '1', name: 'Nandi Hills', distanceMeters: 40000 })]}
      />
    );

    expect(screen.getByTitle('Distance from Bengaluru')).toHaveTextContent('40.0 km');
  });

  it('describes the actual data (open places near Bengaluru, closest first)', () => {
    render(<FeaturedPlaces places={[makeNearbyPlace()]} />);

    expect(
      screen.getByRole('heading', { name: 'Open Destinations Near Bengaluru' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Places currently marked open within 50 km of the city centre — closest first.')
    ).toBeInTheDocument();
  });

  it('renders a graceful empty state when no places are available (never fabricates data)', () => {
    render(<FeaturedPlaces places={[]} />);

    expect(
      screen.getByText('Featured destinations are temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View Nandi Hills' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore all places/ })).toHaveAttribute(
      'href',
      '/explore'
    );
  });

  it('links only to the real explore page (no nonexistent sort modes)', () => {
    render(<FeaturedPlaces places={[makeNearbyPlace()]} />);

    expect(document.querySelector('a[href="/explore?sort=popularity"]')).toBeNull();
    for (const link of screen.getAllByRole('link', { name: /View All/ })) {
      expect(link).toHaveAttribute('href', '/explore');
    }
  });
});
