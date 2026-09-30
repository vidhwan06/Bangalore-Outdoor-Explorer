/** @jest-environment jsdom */
// Integration-style component tests for the discovery container.
// Verifies states, API request construction and accessibility of /explore.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExploreDiscovery } from '@/components/explore/ExploreDiscovery';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

const mockFetch = jest.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

function clickSearch() {
  fireEvent.click(screen.getByRole('button', { name: /search places/i }));
}

describe('ExploreDiscovery', () => {
  it('shows the initial state without calling the API', () => {
    render(<ExploreDiscovery />);

    expect(
      screen.getByRole('heading', { level: 2, name: /ready when you are/i })
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('preselects a category passed from the URL', () => {
    render(<ExploreDiscovery initialCategory="WATERFALL" />);

    expect(screen.getByLabelText('Category')).toHaveValue('WATERFALL');
  });

  it('blocks the request when the latitude is missing', () => {
    render(<ExploreDiscovery />);

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '' } });
    clickSearch();

    expect(screen.getByRole('alert')).toHaveTextContent('Latitude is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('blocks the request when coordinates are out of range', () => {
    render(<ExploreDiscovery />);

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '999' } });
    clickSearch();

    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be between -90 and 90');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows a loading state while the request is in flight', async () => {
    let resolveRequest!: (value: unknown) => void;
    mockFetch.mockImplementation(() => new Promise((resolve) => (resolveRequest = resolve)));

    render(<ExploreDiscovery />);
    clickSearch();

    expect(screen.getByRole('status')).toHaveTextContent(/searching for outdoor places/i);

    await act(async () => {
      resolveRequest(okResponse(makeNearbyResponse([makeNearbyPlace()])));
    });

    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
  });

  it('requests the nearby API with the selected search parameters', async () => {
    mockFetch.mockResolvedValue(okResponse(makeNearbyResponse([makeNearbyPlace()])));

    render(<ExploreDiscovery />);
    fireEvent.change(screen.getByLabelText('Search radius'), { target: { value: '25000' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'TREK' } });
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '3' } });
    clickSearch();

    await screen.findByRole('heading', { level: 3, name: 'Test Peak' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/places/nearby?lat=12.9716&lng=77.5946&radius=25000&limit=20&offset=0&category=TREK&difficulty=3',
      expect.anything()
    );
  });

  it('renders results with counts and place details', async () => {
    const places = [
      makeNearbyPlace(),
      makeNearbyPlace({
        id: 'place-2',
        name: 'Second Hill',
        slug: 'second-hill',
        category: 'VIEWPOINT',
        distanceMeters: 5400,
        difficulty: 1,
        status: 'UNVERIFIED',
        trustLevel: 'COMMUNITY_SUBMITTED',
      }),
    ];
    mockFetch.mockResolvedValue(okResponse(makeNearbyResponse(places, { count: 5 })));

    render(<ExploreDiscovery />);
    clickSearch();

    expect(
      await screen.findByRole('heading', { level: 2, name: '5 places within 10 km' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Second Hill' })).toBeInTheDocument();
    expect(screen.getByText('Showing the 2 closest')).toBeInTheDocument();
  });

  it('shows an empty state when no places match', async () => {
    mockFetch.mockResolvedValue(okResponse(makeNearbyResponse([])));

    render(<ExploreDiscovery />);
    clickSearch();

    expect(
      await screen.findByRole('heading', { level: 2, name: /no places found/i })
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows an error state with a retry action', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockFetch.mockResolvedValueOnce(okResponse(makeNearbyResponse([makeNearbyPlace()])));

    render(<ExploreDiscovery />);
    clickSearch();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not reach the server/i);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Test Peak' })).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('explains rate limiting when the API responds with 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    render(<ExploreDiscovery />);
    clickSearch();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/wait a moment and try again/i);
    expect(screen.getByRole('heading', { level: 2, name: /search failed/i })).toBeInTheDocument();
  });

  it('keeps the search controls available after a failed search', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<ExploreDiscovery />);
    clickSearch();

    await screen.findByRole('alert');

    expect(screen.getByLabelText('Latitude')).toBeEnabled();
    expect(screen.getByLabelText('Category')).toBeEnabled();
    expect(screen.getByRole('button', { name: /search places/i })).toBeEnabled();
  });
});
