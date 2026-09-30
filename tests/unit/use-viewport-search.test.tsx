/** @jest-environment jsdom */
// Unit tests for the viewport search hook — debounce, stale-response
// protection, cancellation and error recovery (data layer, no leaflet).
// Covers pagination: first page at offset 0, subsequent pages append.

import { act, renderHook } from '@testing-library/react';
import { useViewportSearch, VIEWPORT_ERROR_MESSAGES } from '@/features/places/use-viewport-search';
import { fetchPlacesInBounds } from '@/features/places/bounds';
import { NearbyApiError } from '@/features/places/nearby';
import { makeNearbyPlace, makeNearbyResponse } from '../fixtures/nearby-places';

jest.mock('@/features/places/bounds', () => ({
  fetchPlacesInBounds: jest.fn(),
}));

const mockFetchBounds = fetchPlacesInBounds as jest.MockedFunction<typeof fetchPlacesInBounds>;

const QUERY_A = { north: 13.1, south: 12.9, east: 77.7, west: 77.4 };
const QUERY_B = { north: 14, south: 13.5, east: 78.5, west: 78 };
const DEBOUNCE_MS = 25;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(ms = DEBOUNCE_MS * 4) {
  await act(async () => {
    await sleep(ms);
  });
}

beforeEach(() => {
  mockFetchBounds.mockReset();
});

describe('useViewportSearch', () => {
  it('debounces rapid viewport changes into one request with the latest bounds', async () => {
    mockFetchBounds.mockResolvedValue(makeNearbyResponse([makeNearbyPlace()]));
    const onResults = jest.fn();

    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
      result.current.schedule(QUERY_A);
      result.current.schedule(QUERY_B);
    });

    // Status flips to loading immediately; no request before the window closes
    expect(result.current.status).toBe('loading');
    expect(result.current.errorMessage).toBeNull();
    expect(mockFetchBounds).not.toHaveBeenCalled();

    await settle();

    expect(mockFetchBounds).toHaveBeenCalledTimes(1);
    expect(mockFetchBounds).toHaveBeenCalledWith(
      { ...QUERY_B, offset: 0, limit: 20 },
      expect.anything()
    );
    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) }),
      false
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.offset).toBe(20);
    expect(result.current.hasMore).toBe(false);
  });

  it('never delivers a stale response after a newer request was scheduled', async () => {
    let resolveOlder!: (value: ReturnType<typeof makeNearbyResponse>) => void;
    let resolveNewer!: (value: ReturnType<typeof makeNearbyResponse>) => void;
    mockFetchBounds
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          })
      );

    const onResults = jest.fn();
    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();
    expect(mockFetchBounds).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.schedule(QUERY_B);
    });
    await settle();
    expect(mockFetchBounds).toHaveBeenCalledTimes(2);

    // Newer response arrives first...
    await act(async () => {
      resolveNewer(makeNearbyResponse([makeNearbyPlace({ id: 'fresh', name: 'Fresh Peak' })]));
      await sleep(0);
    });
    // ...then the older one lands late and must be dropped
    await act(async () => {
      resolveOlder(makeNearbyResponse([makeNearbyPlace({ id: 'stale', name: 'Stale Peak' })]));
      await sleep(0);
    });

    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults.mock.calls[0][0].data[0].id).toBe('fresh');
    expect(result.current.status).toBe('idle');
  });

  it('reports an error without delivering results, and recovers on retry', async () => {
    mockFetchBounds.mockRejectedValueOnce(
      new NearbyApiError('Rate limit exceeded', 'rate_limited', 429)
    );
    const onResults = jest.fn();

    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();

    expect(onResults).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(VIEWPORT_ERROR_MESSAGES.rate_limited);

    // Retry re-runs the same query once the API recovers
    mockFetchBounds.mockResolvedValueOnce(
      makeNearbyResponse([makeNearbyPlace({ id: 'recovered', name: 'Recovered Peak' })])
    );
    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('loading');

    await settle();

    expect(mockFetchBounds).toHaveBeenCalledTimes(2);
    expect(mockFetchBounds).toHaveBeenLastCalledWith(
      { ...QUERY_A, offset: 0, limit: 20 },
      expect.anything()
    );
    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) }),
      false
    );
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('cancel drops a pending debounced request entirely', async () => {
    const onResults = jest.fn();
    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.status).toBe('idle');

    await settle();

    expect(mockFetchBounds).not.toHaveBeenCalled();
    expect(onResults).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.offset).toBe(0);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalCount).toBe(0);
  });

  it('cancel drops an in-flight response instead of delivering it', async () => {
    let resolveInFlight!: (value: ReturnType<typeof makeNearbyResponse>) => void;
    mockFetchBounds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInFlight = resolve;
        })
    );

    const onResults = jest.fn();
    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();
    expect(mockFetchBounds).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      resolveInFlight(makeNearbyResponse([makeNearbyPlace()]));
      await sleep(0);
    });

    expect(onResults).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.offset).toBe(0);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalCount).toBe(0);
  });

  it('maps unexpected failures to the generic http viewport error', async () => {
    mockFetchBounds.mockRejectedValueOnce(new Error('boom'));
    const onResults = jest.fn();

    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(VIEWPORT_ERROR_MESSAGES.http);
    expect(onResults).not.toHaveBeenCalled();
  });

  it('loadMore appends results and updates pagination state', async () => {
    mockFetchBounds
      .mockResolvedValueOnce(makeNearbyResponse([makeNearbyPlace({ id: 'p1' })], { count: 50 }))
      .mockResolvedValueOnce(makeNearbyResponse([makeNearbyPlace({ id: 'p2' })], { count: 50, offset: 20, limit: 20 }));

    const onResults = jest.fn();
    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();

    expect(result.current.offset).toBe(20);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.totalCount).toBe(50);
    expect(onResults).toHaveBeenCalledTimes(1);

    // Load more
    onResults.mockClear();
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.status).toBe('loading_more');

    await settle();

    expect(mockFetchBounds).toHaveBeenCalledTimes(2);
    expect(mockFetchBounds).toHaveBeenLastCalledWith(
      { ...QUERY_A, offset: 20, limit: 20 },
      expect.anything()
    );
    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) }),
      true
    );
    expect(result.current.offset).toBe(40);
    expect(result.current.status).toBe('idle');
  });

  it('loadMore does nothing when hasMore is false', async () => {
    mockFetchBounds.mockResolvedValue(makeNearbyResponse([makeNearbyPlace()], { count: 10 }));

    const onResults = jest.fn();
    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();

    expect(result.current.hasMore).toBe(false);

    act(() => {
      result.current.loadMore();
    });

    // Should not make another request
    expect(mockFetchBounds).toHaveBeenCalledTimes(1);
  });

  it('new viewport search resets offset and replaces results', async () => {
    mockFetchBounds
      .mockResolvedValueOnce(makeNearbyResponse([makeNearbyPlace({ id: 'p1' })], { count: 30 }))
      .mockResolvedValueOnce(makeNearbyResponse([makeNearbyPlace({ id: 'p2' })], { count: 20 }));

    const onResults = jest.fn();
    const { result } = renderHook(() => useViewportSearch({ onResults, debounceMs: DEBOUNCE_MS }));

    act(() => {
      result.current.schedule(QUERY_A);
    });
    await settle();

    expect(result.current.offset).toBe(20);
    expect(result.current.totalCount).toBe(30);

    onResults.mockClear();
    act(() => {
      result.current.schedule(QUERY_B);
    });
    await settle();

    // New viewport search should reset offset
    expect(mockFetchBounds).toHaveBeenCalledTimes(2);
    expect(mockFetchBounds).toHaveBeenLastCalledWith(
      { ...QUERY_B, offset: 0, limit: 20 },
      expect.anything()
    );
    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) }),
      false
    );
    expect(result.current.offset).toBe(20);
    expect(result.current.totalCount).toBe(20);
  });
});