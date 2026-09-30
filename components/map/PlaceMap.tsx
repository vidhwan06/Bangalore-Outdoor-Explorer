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
import type { MapBounds } from '@/features/places/bounds';
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
  /**
   * Called once the viewport settles (leaflet `moveend`) with a plain,
   * serializable { north, south, east, west } — no Leaflet objects.
   */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Shows a subtle, non-blocking overlay while viewport results load. */
  loading?: boolean;
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
  onBoundsChange,
  loading,
  height,
  className,
}: PlaceMapProps) {
  return (
    <div
      role="group"
      aria-label="Interactive map"
      aria-busy={loading ? 'true' : undefined}
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
        onBoundsChange={onBoundsChange}
      />
      {loading && (
        <div
          role="status"
          aria-label="Updating map results"
          className="pointer-events-none absolute inset-0 z-[1001] flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-gray-900/60"
        >
          <span className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-md dark:bg-gray-800 dark:text-gray-200">
            <svg
              className="h-4 w-4 animate-spin text-green-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Updating places…
          </span>
        </div>
      )}
    </div>
  );
}
