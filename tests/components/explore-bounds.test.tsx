/** @jest-environment jsdom */
// Viewport discovery behaviour on /explore: debounced bounds requests,
// stale-response protection, filter consistency, loading/error states.
// The leaflet engine is mocked here (bounds events are simulated); the real
// moveend conversion is covered by map-bounds-reporter, and the real data
// flow by explore-map.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExploreDiscovery } from '@/components/explore/ExploreDiscovery';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

jest.mock('@/components/map/PlaceMapInner', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: {
      places?: Array<{ id: string; name: string }>;
      selectedPlaceId?: string | null;
      onPlaceSelect?: (id: string) => void;
      onBoundsChange?: (bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
      }) => void;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'map-engine' },
        React.createElement(
          'button',
          {
            type: 'button',
            'aria-label': 'Move viewport A',
            onClick: () =>
              props.onBoundsChange?.({ north: 13.2, south: 12.8, east: 77.8, west: 77.2 }),
          },
          'A'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            'aria-label': 'Move viewport B',
            onClick: () => props.onBoundsChange?.({ north: 14, south: 13.5, east: 78.5, west: 78 }),
          },
          'B'
        ),
        ...(props.places ?? []).map((place) =>
          React.createElement(
            'button',
            {
              key: place.id,
              type: 'button',
              'aria-label': `Marker: ${place.name}`,
              'aria-pressed': String(props.selectedPlaceId === place.id),
              onClick: () => props.onPlaceSelect?.(place.id),
            },
            place.name
          )
        )
      ),
  };
});

const mockFetch = jest.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

async function moveViewport(label: 'Move viewport A' | 'Move viewport B') {
  fireEvent.click(await screen.findByRole('button', { name: label }));
}

async function expectFetchCalls(count: number) {
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(count), { timeout: 2500 });
}

describe('ExploreDiscovery viewport discovery', () => {
  it('requests bounds from the API after the viewport settles', async () => {
    mockFetch.mockResolvedValue(okResponse(makeNearbyResponse([makeNearbyPlace()])));
    render(<ExploreDiscovery />);

    await moveViewport('Move viewport A');
    // Debounced: no request fires synchronously
    expect(mockFetch).not.toHaveBeenCalled();

    await expectFetchCalls(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      '/api/places/bounds?north=13.2&south=12.8&east=77.8&west=77.2&limit=20&offset=0'
    );

    // Results land in both the list and the map (same result set)
    expect(await screen.findByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Marker: Test Peak' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /place in this area/i })
    ).toBeInTheDocument();
  });

  it('debounces rapid viewport changes into a single request for the latest bounds', async () => {
    mockFetch.mockResolvedValue(okResponse(makeNearbyResponse([])));
    render(<ExploreDiscovery />);

    await moveViewport('Move viewport A');
    await moveViewport('Move viewport B');
    expect(mockFetch).not.toHaveBeenCalled(); // still inside the debounce window

    await expectFetchCalls(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('north=14'); // latest viewport wins
    expect(url).not.toContain('north=13.2');
  });

  it('preserves existing results and shows only a subtle map indicator while loading', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(makeNearbyResponse([makeNearbyPlace()])));
    render(<ExploreDiscovery />);

    fireEvent.click(screen.getByRole('button', { name: /search places/i }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();

    // Viewport request stays pending
    mockFetch.mockImplementationOnce(() => new Promise(() => undefined));
    await moveViewport('Move viewport A');

    const indicator = await screen.findByRole(
      'status',
      { name: 'Updating map results' },
      { timeout: 2500 }
    );
    expect(indicator).toBeInTheDocument();

    // The discovery page/results are NOT replaced by the viewport load
    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /within 10 km/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /searching for outdoor places/i })).toBeNull();
  });

  it('never lets a stale viewport response overwrite newer results', async () => {
    const stale = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    const fresh = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    render(<ExploreDiscovery />);

    mockFetch.mockReturnValueOnce(stale.promise);
    await moveViewport('Move viewport A');
    await expectFetchCalls(1);

    mockFetch.mockReturnValueOnce(fresh.promise);
    await moveViewport('Move viewport B');
    await expectFetchCalls(2);

    // The newer request resolves first
    await act(async () => {
      fresh.resolve(
        okResponse(
          makeNearbyResponse([
            makeNearbyPlace({ id: 'fresh', name: 'Fresh Peak', slug: 'fresh-peak' }),
          ])
        )
      );
      await sleep(0);
    });
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Fresh Peak' })
    ).toBeInTheDocument();

    // The older response arrives late and must be ignored
    await act(async () => {
      stale.resolve(
        okResponse(
          makeNearbyResponse([
            makeNearbyPlace({ id: 'stale', name: 'Stale Peak', slug: 'stale-peak' }),
          ])
        )
      );
      await sleep(20);
    });

    expect(screen.getByRole('heading', { level: 3, name: 'Fresh Peak' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Stale Peak' })).not.toBeInTheDocument();
  });

  it('applies the active category and difficulty filters to viewport requests', async () => {
    mockFetch.mockResolvedValue(okResponse(makeNearbyResponse([])));
    render(<ExploreDiscovery />);

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'TREK' } });
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '3' } });

    await moveViewport('Move viewport A');
    await expectFetchCalls(1);

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('north=13.2');
    expect(url).toContain('category=TREK');
    expect(url).toContain('difficulty=3');
  });

  it('shows a recoverable error without destroying existing results', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(makeNearbyResponse([makeNearbyPlace()])));
    render(<ExploreDiscovery />);

    fireEvent.click(screen.getByRole('button', { name: /search places/i }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();

    // Viewport request fails (network)
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await moveViewport('Move viewport A');

    const alert = await screen.findByRole('alert', {}, { timeout: 2500 });
    expect(alert).toHaveTextContent(/map update failed/i);
    // Previous results survive the failure
    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /within 10 km/i })).toBeInTheDocument();

    // Retry recovers with fresh viewport data
    mockFetch.mockResolvedValueOnce(
      okResponse(
        makeNearbyResponse([
          makeNearbyPlace({ id: 'recovered', name: 'Recovered Peak', slug: 'recovered-peak' }),
        ])
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Recovered Peak' }, { timeout: 2500 })
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Marker: Recovered Peak' })
    ).toBeInTheDocument();
  });
});
