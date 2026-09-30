// Reusable place map — public API for the discovery/details UI.
//
// Leaflet touches `window` at import time, so the rendering half lives behind
// `next/dynamic` with `ssr: false`. This wrapper is safe to render from any
// component (client or server); the browser loads the map engine on demand.
// Business logic stays out: the component only plots typed, pre-validated
// MapPlacePoint props (privacy is enforced upstream in features/places/map-places).

'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import type { MapPlacePoint } from '@/features/places/map-places';

const PlaceMapInner = dynamic(() => import('./PlaceMapInner'), {
  ssr: false,
  loading: () => null,
});

export interface PlaceMapCenter {
  latitude: number;
  longitude: number;
}

export interface PlaceMapProps {
  /**
   * Marker-ready places. Locations must already be map-safe
   * (see `toMapPlacePoint` — the component never interprets visibility itself).
   */
  places: MapPlacePoint[];
  /** Initial map centre. Falls back to the centre of the plotted markers. */
  center?: PlaceMapCenter;
  /** Initial zoom. Falls back to a sensible marker/world zoom. */
  zoom?: number;
  /** Currently selected marker (visual state only). */
  selectedPlaceId?: string | null;
  /** Called when a marker is clicked or activated from the keyboard. */
  onPlaceSelect?: (id: string) => void;
  /** CSS height of the map box. Defaults to filling its container. */
  height?: string;
  /** Extra classes for the map box (sizing, layout). */
  className?: string;
}

export function PlaceMap({
  places,
  center,
  zoom,
  selectedPlaceId,
  onPlaceSelect,
  height,
  className,
}: PlaceMapProps) {
  return (
    <div
      role="group"
      aria-label="Interactive map"
      className={cn(
        'relative min-h-[12rem] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900',
        className
      )}
      style={{ height: height ?? '100%' }}
    >
      <PlaceMapInner
        places={places}
        center={center}
        zoom={zoom}
        selectedPlaceId={selectedPlaceId}
        onPlaceSelect={onPlaceSelect}
      />
    </div>
  );
}
