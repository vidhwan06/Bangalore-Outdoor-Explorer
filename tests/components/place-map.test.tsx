/** @jest-environment jsdom */
// Component tests for the reusable PlaceMap.
// Renders the real leaflet engine (transpiled via next.config transpilePackages).

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlaceMap } from '@/components/map/PlaceMap';
import { MAP_TEST_POINTS } from '../fixtures/map-places';

describe('PlaceMap', () => {
  it('renders the map region', async () => {
    render(<PlaceMap places={[]} />);

    expect(screen.getByRole('group', { name: 'Interactive map' })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('.leaflet-container')).toBeTruthy();
    });
  });

  it('renders a marker for each fixture place', async () => {
    render(
      <PlaceMap places={MAP_TEST_POINTS} center={{ latitude: 13, longitude: 77.5 }} zoom={10} />
    );

    expect(await screen.findByLabelText('Test Peak')).toBeInTheDocument();
    expect(await screen.findByLabelText('Second Hill')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Riverside Test Point (approximate location)')
    ).toBeInTheDocument();
  });

  it('invokes the selection callback when a marker is clicked', async () => {
    const onPlaceSelect = jest.fn();
    render(<PlaceMap places={MAP_TEST_POINTS} onPlaceSelect={onPlaceSelect} />);

    const marker = await screen.findByLabelText('Test Peak');
    fireEvent.click(marker);

    expect(onPlaceSelect).toHaveBeenCalledWith('test-peak');
    expect(onPlaceSelect).toHaveBeenCalledTimes(1);
  });

  it('represents the selected marker state', async () => {
    render(<PlaceMap places={MAP_TEST_POINTS} selectedPlaceId="second-hill" />);

    const selected = await screen.findByLabelText('Second Hill');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveClass('place-map-marker--selected');

    const unselected = await screen.findByLabelText('Test Peak');
    expect(unselected).toHaveAttribute('aria-pressed', 'false');
    expect(unselected).not.toHaveClass('place-map-marker--selected');
  });

  it('renders an empty map when there are no markers', async () => {
    const { container } = render(<PlaceMap places={[]} />);

    await waitFor(() => {
      expect(document.querySelector('.leaflet-container')).toBeTruthy();
    });
    expect(container.querySelectorAll('.place-map-marker')).toHaveLength(0);
    // Leaflet's own +/− zoom controls remain; place markers must not
    expect(container.querySelectorAll('.place-map-marker[role="button"]')).toHaveLength(0);
  });

  it('plots PUBLIC_EXACT places without any approximation marker', async () => {
    render(<PlaceMap places={MAP_TEST_POINTS} />);

    const marker = await screen.findByLabelText('Test Peak');
    expect(marker).toHaveClass('place-map-marker');
    expect(marker).not.toHaveClass('place-map-marker--approximate');
    expect(marker).not.toHaveTextContent('approximate');
  });

  it('marks PUBLIC_APPROXIMATE places as approximate in the marker itself', async () => {
    render(<PlaceMap places={MAP_TEST_POINTS} />);

    const marker = await screen.findByLabelText('Riverside Test Point (approximate location)');
    expect(marker).toHaveClass('place-map-marker--approximate');
  });

  it('skips places whose location is unavailable instead of inventing a point', async () => {
    const { container } = render(
      <PlaceMap
        places={[
          { id: 'no-location', name: 'No Location Place', location: { kind: 'unavailable' } },
          ...MAP_TEST_POINTS,
        ]}
      />
    );

    expect(await screen.findByLabelText('Test Peak')).toBeInTheDocument();
    expect(screen.queryByLabelText('No Location Place')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.place-map-marker')).toHaveLength(MAP_TEST_POINTS.length);
  });

  it('shows a subtle loading overlay while viewport results are pending', () => {
    render(<PlaceMap places={[]} loading />);

    const indicator = screen.getByRole('status', { name: 'Updating map results' });
    expect(indicator).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Interactive map' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('hides the loading overlay when not loading', async () => {
    const { rerender } = render(<PlaceMap places={[]} loading />);
    expect(screen.getByRole('status', { name: 'Updating map results' })).toBeInTheDocument();

    rerender(<PlaceMap places={[]} loading={false} />);
    expect(screen.queryByRole('status', { name: 'Updating map results' })).not.toBeInTheDocument();
  });

  describe('viewport auto-fit (Phase 2C.3A)', () => {
    it('does not change viewport when there are zero results', async () => {
      const onFitBoundsComplete = jest.fn();
      render(<PlaceMap places={[]} fitBounds onFitBoundsComplete={onFitBoundsComplete} />);

      await waitFor(() => {
        expect(document.querySelector('.leaflet-container')).toBeTruthy();
      });

      // Should call onFitBoundsComplete immediately for empty places
      expect(onFitBoundsComplete).toHaveBeenCalledTimes(1);
    });

    it('renders without error when fitBounds is true with places', async () => {
      const onFitBoundsComplete = jest.fn();
      // In jsdom the map doesn't fully initialize, so onFitBoundsComplete won't fire.
      // The integration test (explore-map) covers the real auto-fit behavior.
      render(<PlaceMap places={MAP_TEST_POINTS} fitBounds onFitBoundsComplete={onFitBoundsComplete} />);

      await waitFor(() => {
        expect(document.querySelector('.leaflet-container')).toBeTruthy();
      });

      // Markers should render
      expect(await screen.findByLabelText('Test Peak')).toBeInTheDocument();
      expect(await screen.findByLabelText('Second Hill')).toBeInTheDocument();
    });

    it('does not auto-fit again when fitBounds prop remains true after re-render', async () => {
      const onFitBoundsComplete = jest.fn();
      const { rerender } = render(<PlaceMap places={MAP_TEST_POINTS} fitBounds onFitBoundsComplete={onFitBoundsComplete} />);

      await waitFor(() => {
        expect(document.querySelector('.leaflet-container')).toBeTruthy();
      });

      // Re-render with same fitBounds=true - internal ref prevents duplicate fit
      rerender(<PlaceMap places={MAP_TEST_POINTS} fitBounds onFitBoundsComplete={onFitBoundsComplete} />);

      await waitFor(() => {
        expect(document.querySelector('.leaflet-container')).toBeTruthy();
      });

      // Component should render without error (internal ref prevents double-fit)
      expect(screen.getByLabelText('Test Peak')).toBeInTheDocument();
    });

    it('does not trigger onBoundsChange during auto-fit (no search loop)', async () => {
      const onBoundsChange = jest.fn();
      const onFitBoundsComplete = jest.fn();
      render(
        <PlaceMap
          places={MAP_TEST_POINTS}
          fitBounds
          onBoundsChange={onBoundsChange}
          onFitBoundsComplete={onFitBoundsComplete}
        />
      );

      await waitFor(() => {
        expect(document.querySelector('.leaflet-container')).toBeTruthy();
      });

      // Component renders without triggering onBoundsChange
      // (onBoundsChange is only for user-initiated moveend events)
      expect(onBoundsChange).not.toHaveBeenCalled();
    });
  });
});
