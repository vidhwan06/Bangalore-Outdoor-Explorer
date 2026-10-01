/** @jest-environment jsdom */
// Component tests for map marker clustering (Phase 2: map marker clustering).
//
// Product behaviour under test:
// - zoom >= 9 (the explore default): every place plots individually.
// - zoom < 9 (zoomed out): overlapping places group into an expandable cluster.
// - clusters show their member count and expand (zoom in) when clicked.
// - the selected place is never absorbed into a cluster, so marker/card
//   selection stays synchronized at any zoom level.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import L from 'leaflet';
import { PlaceMap } from '@/components/map/PlaceMap';
import type { MapPlacePoint } from '@/features/places/map-places';

// Grid cell size at zoom 8 is 0.4°:
// - A and B fall into the same cell (they cluster together).
// - C lands in a different cell (it always plots individually).
const A = { lat: 12.9716, lng: 77.5946 };
const B = { lat: 12.98, lng: 77.59 };
const C = { lat: 13.37, lng: 77.68 };

const NEARBY_A: MapPlacePoint = {
  id: 'nearby-a',
  name: 'Nearby A',
  location: { kind: 'exact', latitude: A.lat, longitude: A.lng },
};
const NEARBY_B: MapPlacePoint = {
  id: 'nearby-b',
  name: 'Nearby B',
  location: { kind: 'exact', latitude: B.lat, longitude: B.lng },
};
const FAR_C: MapPlacePoint = {
  id: 'far-c',
  name: 'Far C',
  location: { kind: 'exact', latitude: C.lat, longitude: C.lng },
};

const CLUSTER_POINTS: MapPlacePoint[] = [NEARBY_A, NEARBY_B, FAR_C];

async function waitForCluster(container: HTMLElement): Promise<HTMLElement> {
  await waitFor(() => {
    expect(container.querySelector('.marker-cluster')).toBeTruthy();
  });
  return container.querySelector('.marker-cluster') as HTMLElement;
}

describe('marker clustering', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('groups nearby places into a cluster when zoomed out below zoom 9', async () => {
    const { container } = render(<PlaceMap places={CLUSTER_POINTS} zoom={8} />);

    await waitForCluster(container);

    // The clustered places are not plotted individually...
    expect(screen.queryByLabelText('Nearby A')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nearby B')).not.toBeInTheDocument();
    // ...while the unclustered far-away place still plots on its own.
    expect(await screen.findByLabelText('Far C')).toBeInTheDocument();
    expect(container.querySelectorAll('.marker-cluster')).toHaveLength(1);
  });

  it('shows the number of grouped places on the cluster', async () => {
    const { container } = render(<PlaceMap places={CLUSTER_POINTS} zoom={8} />);

    const cluster = await waitForCluster(container);
    expect(cluster).toHaveTextContent(/^2$/);
  });

  it.each([9, 10])(
    'plots individual markers at zoom %i (clustering disabled)',
    async (zoom) => {
      const { container } = render(<PlaceMap places={CLUSTER_POINTS} zoom={zoom} />);

      expect(await screen.findByLabelText('Nearby A')).toBeInTheDocument();
      expect(await screen.findByLabelText('Nearby B')).toBeInTheDocument();
      expect(await screen.findByLabelText('Far C')).toBeInTheDocument();
      expect(container.querySelectorAll('.marker-cluster')).toHaveLength(0);
    }
  );

  it('expands a cluster on click by zooming the map in', async () => {
    const setViewSpy = jest.spyOn(L.Map.prototype, 'setView');
    const { container } = render(<PlaceMap places={CLUSTER_POINTS} zoom={8} />);

    const cluster = await waitForCluster(container);
    fireEvent.click(cluster);

    expect(setViewSpy).toHaveBeenCalled();
    const [center, zoom] = setViewSpy.mock.calls[setViewSpy.mock.calls.length - 1];
    // Zoom in two levels from 8…
    expect(zoom).toBe(10);
    // …centred on the cluster (the mean of its two member coordinates).
    expect(center[0]).toBeCloseTo((A.lat + B.lat) / 2);
    expect(center[1]).toBeCloseTo((A.lng + B.lng) / 2);
  });

  it('keeps individual marker selection working while clustering is active', async () => {
    const onPlaceSelect = jest.fn();
    const { container } = render(
      <PlaceMap places={CLUSTER_POINTS} zoom={8} onPlaceSelect={onPlaceSelect} />
    );

    const marker = await screen.findByLabelText('Far C');
    fireEvent.click(marker);

    expect(onPlaceSelect).toHaveBeenCalledWith('far-c');
    expect(container.querySelectorAll('.marker-cluster')).toHaveLength(1);
  });

  it('renders the selected place as an individual, pressed marker while clustering is active', async () => {
    const { container } = render(
      <PlaceMap places={CLUSTER_POINTS} zoom={8} selectedPlaceId="far-c" />
    );

    const selected = await screen.findByLabelText('Far C');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveClass('place-map-marker--selected');
    expect(container.querySelectorAll('.marker-cluster')).toHaveLength(1);
  });

  it('never absorbs the selected place into a cluster (marker/card sync)', async () => {
    const { container } = render(
      <PlaceMap places={CLUSTER_POINTS} zoom={8} selectedPlaceId="nearby-a" />
    );

    // Both members of the would-be cluster plot individually so the selected
    // marker stays visible on the map while its card is highlighted in the list.
    const selected = await screen.findByLabelText('Nearby A');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByLabelText('Nearby B')).toBeInTheDocument();
    expect(container.querySelectorAll('.marker-cluster')).toHaveLength(0);
  });
});
