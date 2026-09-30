/** @jest-environment jsdom */
// Verifies leaflet's moveend event is converted to a plain, serializable
// { north, south, east, west } payload — and that nothing else fires it.

import { act, render } from '@testing-library/react';
import L from 'leaflet';
import { MapContainer, useMap } from 'react-leaflet';
import { MapBoundsReporter } from '@/components/map/MapBoundsReporter';
import type { MapBounds } from '@/features/places/bounds';

let mapInstance: L.Map | null = null;

function MapGrabber() {
  mapInstance = useMap();
  return null;
}

describe('MapBoundsReporter', () => {
  beforeEach(() => {
    mapInstance = null;
  });

  it('emits plain serializable bounds once per settled viewport (moveend only)', () => {
    const onBoundsChange = jest.fn();

    render(
      <MapContainer center={[13, 77.5]} zoom={10} className="h-full w-full">
        <MapBoundsReporter onBoundsChange={onBoundsChange} />
        <MapGrabber />
      </MapContainer>
    );

    expect(mapInstance).not.toBeNull();

    // Per-pixel movement / zoom start must NOT report bounds
    act(() => {
      mapInstance?.fire('movestart');
      mapInstance?.fire('move');
      mapInstance?.fire('zoom');
      mapInstance?.fire('zoomstart');
    });
    expect(onBoundsChange).not.toHaveBeenCalled();

    // The settled viewport reports exactly once
    act(() => {
      mapInstance?.fire('moveend');
    });
    expect(onBoundsChange).toHaveBeenCalledTimes(1);

    const payload: MapBounds = onBoundsChange.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(['east', 'north', 'south', 'west']);
    expect(payload).toEqual({
      north: expect.any(Number),
      south: expect.any(Number),
      east: expect.any(Number),
      west: expect.any(Number),
    });
    expect(payload.north).not.toBeNaN();
    expect(payload.south).not.toBeNaN();

    // Serializable: survives a JSON round-trip — no Leaflet objects leak out
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    // Bounds invariants, and edges stay at the map centre (jsdom containers
    // have no layout, so the viewport is degenerate around center/zoom)
    expect(payload.north).toBeGreaterThanOrEqual(payload.south);
    expect(payload.east).toBeGreaterThanOrEqual(payload.west);
    expect(payload.north).toBeCloseTo(13, 1);
    expect(payload.south).toBeCloseTo(13, 1);
    expect(payload.east).toBeCloseTo(77.5, 1);
    expect(payload.west).toBeCloseTo(77.5, 1);
  });

  it('does nothing when no callback is provided', () => {
    render(
      <MapContainer center={[13, 77.5]} zoom={10} className="h-full w-full">
        <MapBoundsReporter />
        <MapGrabber />
      </MapContainer>
    );

    expect(() =>
      act(() => {
        mapInstance?.fire('moveend');
      })
    ).not.toThrow();
  });
});
