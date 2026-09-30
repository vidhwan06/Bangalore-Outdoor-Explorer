// Map rendering half of PlaceMap — loaded lazily in the browser only
// (leaflet accesses `window` at import time, so this must never run on the server).

'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import type { MapPlaceLocation, MapPlacePoint } from '@/features/places/map-places';
import { MapBoundsReporter } from './MapBoundsReporter';
import type { PlaceMapCenter, PlaceMapProps } from './PlaceMap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type PlottablePlace = Omit<MapPlacePoint, 'location'> & {
  location: Extract<MapPlaceLocation, { latitude: number }>;
};

function isPlottable(place: MapPlacePoint): place is PlottablePlace {
  return place.location.kind !== 'unavailable';
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/**
 * Builds a dependency-free marker (divIcon — no image assets).
 * - exact: solid primary green
 * - approximate: amber with a dashed ring + an explicit label, so an
 *   approximate location is visibly and accessibly different
 * - selected: larger with a halo, exposed via aria-pressed
 */
function buildMarkerIcon(place: PlottablePlace, selected: boolean): L.DivIcon {
  const approximate = place.location.kind === 'approximate';
  const size = selected ? 22 : 16;
  const background = approximate ? '#d97706' : '#16a34a';
  const border = approximate ? '2px dashed #ffffff' : '2px solid #ffffff';
  const label = approximate ? `${place.name} (approximate location)` : place.name;
  const classes = [
    'place-map-marker',
    approximate ? 'place-map-marker--approximate' : '',
    selected ? 'place-map-marker--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const halo = selected ? ';outline:3px solid rgba(22,163,74,.45)' : '';

  return L.divIcon({
    className: 'place-map-marker-anchor',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="${classes}" role="button" aria-pressed="${
      selected ? 'true' : 'false'
    }" aria-label="${escapeHtml(label)}" style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${background};border:${border};box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer${halo}"></span>`,
  });
}

function resolveCenter(
  center: PlaceMapCenter | undefined,
  places: PlottablePlace[]
): [number, number] {
  if (center) {
    return [center.latitude, center.longitude];
  }
  if (places.length > 0) {
    const latitude =
      places.reduce((sum, place) => sum + place.location.latitude, 0) / places.length;
    const longitude =
      places.reduce((sum, place) => sum + place.location.longitude, 0) / places.length;
    return [latitude, longitude];
  }
  // No centre and no markers: a plain world view (no location baked in).
  return [0, 0];
}

export default function PlaceMapInner({
  places,
  center,
  zoom,
  selectedPlaceId,
  onPlaceSelect,
  onBoundsChange,
  fitBounds,
  onFitBoundsComplete,
  isVisible = true,
}: PlaceMapProps) {
  const plottablePlaces = places.filter(isPlottable);
  const resolvedCenter = resolveCenter(center, plottablePlaces);
  const resolvedZoom = zoom ?? (plottablePlaces.length > 0 ? 9 : 2);

  const mapRef = useRef<L.Map | null>(null);
  const fitBoundsDoneRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // Set mapReady after the map ref is attached (useLayoutEffect avoids act warnings).
  useLayoutEffect(() => {
    if (mapRef.current) {
      setMapReady(true);
    }
  }, []);

  // Invalidate map size when:
  // - mapReady becomes true (initial mount)
  // - isVisible transitions to true (map becomes visible after being hidden)
  // Only runs when the map is both ready AND visible.
  useEffect(() => {
    if (mapReady && isVisible && mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [mapReady, isVisible]);

  // One-time fitBounds to the current markers after the map initializes.
  useEffect(() => {
    if (!fitBounds || fitBoundsDoneRef.current) {
      return;
    }
    if (plottablePlaces.length === 0) {
      // No markers to fit to — nothing to do. Call completion immediately.
      onFitBoundsComplete?.();
      fitBoundsDoneRef.current = true;
      return;
    }
    if (!mapReady || !mapRef.current) {
      // Map not ready yet; will retry when mapReady becomes true.
      return;
    }

    const latLngs = plottablePlaces.map((place) => [
      place.location.latitude,
      place.location.longitude,
    ] as L.LatLngExpression);

    const bounds = L.latLngBounds(latLngs);

    if (plottablePlaces.length === 1) {
      // Single marker: center on it with a sensible zoom.
      mapRef.current.setView(latLngs[0], 13);
    } else {
      // Multiple markers: fit with padding.
      mapRef.current.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }

    fitBoundsDoneRef.current = true;
    onFitBoundsComplete?.();
  }, [fitBounds, plottablePlaces, onFitBoundsComplete, mapReady]);

  return (
    // center/zoom are the map's initial view (react-leaflet ignores later changes);
    // markers below are fully reactive to prop updates.
    <MapContainer
      ref={mapRef}
      center={resolvedCenter}
      zoom={resolvedZoom}
      className="h-full w-full"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapBoundsReporter onBoundsChange={onBoundsChange} />
      {plottablePlaces.map((place) => (
        <Marker
          key={place.id}
          position={[place.location.latitude, place.location.longitude]}
          icon={buildMarkerIcon(place, place.id === selectedPlaceId)}
          zIndexOffset={place.id === selectedPlaceId ? 1000 : 0}
          eventHandlers={{
            click: () => onPlaceSelect?.(place.id),
            keydown: (event) => {
              if (
                event.originalEvent instanceof KeyboardEvent &&
                (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ')
              ) {
                event.originalEvent.preventDefault();
                onPlaceSelect?.(place.id);
              }
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {place.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
