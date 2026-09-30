// Emits serializable viewport bounds from leaflet's moveend event.
//
// Nothing Leaflet-specific leaves this component: parents receive a plain
// { north, south, east, west } object (features/places/bounds MapBounds)
// that they can debounce, fetch with and store. Only `moveend` is listened
// to — once per settled pan/zoom, not once per pixel of movement.

'use client';

import { useCallback } from 'react';
import { useMap, useMapEvent } from 'react-leaflet';
import type { MapBounds } from '@/features/places/bounds';

export interface MapBoundsReporterProps {
  onBoundsChange?: (bounds: MapBounds) => void;
}

export function MapBoundsReporter({ onBoundsChange }: MapBoundsReporterProps) {
  const map = useMap();

  const reportBounds = useCallback(() => {
    if (!onBoundsChange) {
      return;
    }
    const bounds = map.getBounds();
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [map, onBoundsChange]);

  useMapEvent('moveend', reportBounds);

  return null;
}
