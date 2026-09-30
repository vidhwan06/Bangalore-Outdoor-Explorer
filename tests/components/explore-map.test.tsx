/** @jest-environment jsdom */
// Explore markers are fed by the discovery API through the central privacy
// mapper — the list and the map render the same result set, and selection
// stays synchronised in both directions (Phase 2C.2).

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExploreDiscovery } from '@/components/explore/ExploreDiscovery';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

const mockFetch = jest.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function apiPlaces() {
  return [
    makeNearbyPlace(), // Test Peak — exact
    makeNearbyPlace({
      id: 'place-2',
      name: 'Second Hill',
      slug: 'second-hill',
      latitude: 13.08,
      longitude: 77.59,
    }),
    makeNearbyPlace({
      id: 'place-3',
      name: 'Riverside Test Point',
      slug: 'riverside-test-point',
      latitude: 12.95,
      longitude: 77.48,
      visibilityLevel: 'PUBLIC_APPROXIMATE',
    }),
  ];
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

async function renderWithResults() {
  mockFetch.mockResolvedValue(okResponse(makeNearbyResponse(apiPlaces())));
  render(<ExploreDiscovery />);
  fireEvent.click(screen.getByRole('button', { name: /search places/i }));
  // Wait until the list has rendered the API results
  await screen.findByRole('heading', { level: 3, name: 'Test Peak' });
}

describe('ExploreDiscovery map integration', () => {
  it('renders an idle page with an empty map and no API requests', async () => {
    render(<ExploreDiscovery />);

    expect(
      screen.getByRole('heading', { level: 2, name: /ready when you are/i })
    ).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Interactive map' })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('.leaflet-container')).toBeTruthy();
    });

    // No markers before a search — and no stray viewport request on load
    expect(document.querySelectorAll('.place-map-marker')).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('feeds the map with markers from the API result set', async () => {
    await renderWithResults();

    // List: the API rows
    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Second Hill' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Riverside Test Point' })
    ).toBeInTheDocument();

    // Map: markers for the same rows, privacy-mapped
    expect(await screen.findByRole('button', { name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Second Hill' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Riverside Test Point (approximate location)' })
    ).toBeInTheDocument();

    // Same result set: one marker per card, no extras
    expect(document.querySelectorAll('.place-map-marker')).toHaveLength(3);
  });

  it('only requested the nearby API once for both list and map', async () => {
    await renderWithResults();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/places/nearby?');
    expect(String(mockFetch.mock.calls[0][0])).not.toContain('/api/places/bounds');
  });

  it('selects the matching result card when a marker is clicked', async () => {
    await renderWithResults();

    const marker = await screen.findByRole('button', { name: 'Test Peak' });
    expect(marker).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(marker);

    const card = await screen.findByRole('article', { name: 'Test Peak' });
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(card).toHaveAttribute('data-selected', 'true');
  });

  it('selects the matching marker when a result card is clicked', async () => {
    await renderWithResults();

    const card = await screen.findByRole('article', { name: 'Test Peak' });
    fireEvent.click(card);

    expect(card).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByRole('button', { name: 'Test Peak' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Other markers stay unselected
    expect(screen.getByRole('button', { name: 'Second Hill' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
