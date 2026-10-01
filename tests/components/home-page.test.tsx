/** @jest-environment jsdom */
// Homepage resilience tests: featured places load server-side from the
// database, and the homepage still renders (with the FeaturedPlaces empty
// state) when the database is unavailable.

import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { placeService } from '@/features/places/services';
import { makeNearbyPlace } from '../fixtures/nearby-places';

jest.mock('@/features/places/services', () => ({
  placeService: {
    getFeaturedPlaces: jest.fn(),
    getCategoryCounts: jest.fn(),
  },
}));

const getFeaturedPlaces = placeService.getFeaturedPlaces as jest.MockedFunction<
  typeof placeService.getFeaturedPlaces
>;
const getCategoryCounts = placeService.getCategoryCounts as jest.MockedFunction<
  typeof placeService.getCategoryCounts
>;

describe('HomePage featured places', () => {
  beforeEach(() => {
    getCategoryCounts.mockResolvedValue({});
  });

  it('renders database-backed featured places when the database is available', async () => {
    getFeaturedPlaces.mockResolvedValue({
      data: [
        makeNearbyPlace({
          id: '1',
          name: 'Savandurga Hill',
          slug: 'savandurga-hill',
          distanceMeters: 50000,
        }),
      ],
      pagination: { limit: 8, offset: 0, count: 1, hasMore: false },
    });

    render(await HomePage());

    expect(getFeaturedPlaces).toHaveBeenCalledWith(8);
    expect(getCategoryCounts).toHaveBeenCalled();
    expect(screen.getByText('Savandurga Hill')).toBeInTheDocument();
    expect(screen.getByTitle('Distance from Bengaluru')).toHaveTextContent('50.0 km');
  });

  it('falls back to the empty state when the database is unavailable', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getFeaturedPlaces.mockRejectedValue(new Error('database unreachable'));
    getCategoryCounts.mockRejectedValue(new Error('database unreachable'));

    render(await HomePage());

    // The homepage still renders, and no destinations are fabricated.
    expect(
      screen.getByText('Featured destinations are temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open Destinations Near Bengaluru' })).toBeInTheDocument();
    // The failure stays visible server-side.
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load homepage data'),
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
