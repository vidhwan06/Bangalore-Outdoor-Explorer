/** @jest-environment jsdom */
// Tests for the place details presentation.
// Uses synthetic fixtures only and asserts that unavailable fields are never rendered.

import { render, screen, within } from '@testing-library/react';
import { PlaceDetails } from '@/components/places/PlaceDetails';
import { makePlaceDetail } from '../fixtures/place-details';

describe('PlaceDetails', () => {
  it('renders the fields the backend actually provides', () => {
    render(<PlaceDetails place={makePlaceDetail()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByText('Trek')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('3/5 · Challenging')).toBeInTheDocument();
    expect(screen.getByText('Verified source')).toBeInTheDocument();
    expect(screen.getByText('A synthetic description used only in tests.')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation back to explore', () => {
    render(<PlaceDetails place={makePlaceDetail()} />);

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/explore');
    const breadcrumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(breadcrumb.getByText('Test Peak')).toBeInTheDocument();
  });

  it('falls back to the short description when no long description exists', () => {
    render(<PlaceDetails place={makePlaceDetail({ description: null })} />);

    expect(screen.getByText('A steep climb above the city')).toBeInTheDocument();
  });

  it('states when no description is available rather than inventing one', () => {
    render(<PlaceDetails place={makePlaceDetail({ description: null, shortDescription: null })} />);

    expect(screen.getByText('Description not available yet.')).toBeInTheDocument();
  });

  it('shows distance from the discovery location when available', () => {
    render(<PlaceDetails place={makePlaceDetail()} distanceMeters={1234} />);

    expect(screen.getByText('1.2 km from your search location')).toBeInTheDocument();
  });

  it('omits the distance row when the origin is unknown', () => {
    render(<PlaceDetails place={makePlaceDetail()} distanceMeters={null} />);

    expect(screen.queryByText(/from your search location/)).not.toBeInTheDocument();
  });

  it('explains approximate locations for PUBLIC_APPROXIMATE places', () => {
    render(<PlaceDetails place={makePlaceDetail({ visibilityLevel: 'PUBLIC_APPROXIMATE' })} />);

    expect(screen.getByText(/Approximate location/)).toBeInTheDocument();
    expect(screen.getByText(/exact coordinates .* are not published/)).toBeInTheDocument();
  });

  it('does not show the privacy notice for public exact places', () => {
    render(<PlaceDetails place={makePlaceDetail({ visibilityLevel: 'PUBLIC_EXACT' })} />);

    expect(screen.queryByText(/Approximate location/)).not.toBeInTheDocument();
  });

  it('renders official sources with a safe external link', () => {
    render(<PlaceDetails place={makePlaceDetail()} />);

    const link = screen.getByRole('link', { name: 'Forest Department' });
    expect(link).toHaveAttribute('href', 'https://example.gov.in/test-peak');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/Official government/)).toBeInTheDocument();
  });

  it('renders sources without a URL as plain text', () => {
    render(
      <PlaceDetails
        place={makePlaceDetail({
          sources: [{ id: 'source-2', name: 'Contributor notes', type: 'USER_VISIT', url: null }],
        })}
      />
    );

    expect(screen.getByText('Contributor notes')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contributor notes' })).not.toBeInTheDocument();
  });

  it('hides the sources section when there are none', () => {
    render(<PlaceDetails place={makePlaceDetail({ sources: [] })} />);

    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('renders the map component in the location panel', async () => {
    render(<PlaceDetails place={makePlaceDetail()} />);

    expect(screen.getByRole('complementary', { name: 'Map' })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Interactive map' })).toBeInTheDocument();
  });

  it('never renders fabricated fields', () => {
    render(<PlaceDetails place={makePlaceDetail()} distanceMeters={1234} />);

    // Fields the backend does not provide must not appear anywhere on the page
    expect(screen.queryByText('Parking')).not.toBeInTheDocument();
    expect(screen.queryByText('Entry fee')).not.toBeInTheDocument();
    expect(screen.queryByText('₹')).not.toBeInTheDocument();
    expect(screen.queryByText('Opening hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Trail distance')).not.toBeInTheDocument();
    expect(screen.queryByText('Elevation')).not.toBeInTheDocument();
    expect(screen.queryByText('4.8')).not.toBeInTheDocument();
    // Raw coordinates are never exposed
    expect(screen.queryByText('13.0')).not.toBeInTheDocument();
    expect(screen.queryByText('77.5')).not.toBeInTheDocument();
  });
});
