// Map rendering half of PlaceMap — loaded lazily in the browser only
// (leaflet accesses `window` at import time, so this must never run on the server).

'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import type { MapPlaceLocation, MapPlacePoint } from '@/features/places/map-places';
import { MapBoundsReporter } from './MapBoundsReporter';
import type { PlaceMapCenter, PlaceMapProps } from './PlaceMap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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

/** Escapes a value for safe interpolation into marker HTML (aria-labels). */
export function escapeHtml(value: string): string {
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

/** A single item on the map: an individual marker or a group of clustered places. */
type ClusteredItem =
  | { type: 'marker'; place: PlottablePlace }
  | { type: 'cluster'; count: number; places: PlottablePlace[]; center: [number, number] };

/**
 * Simple grid-based clustering for client-side clustering.
 * Groups nearby points into clusters based on zoom level.
 *
 * Product behaviour:
 * - zoom >= 9 (the explore default): every place plots individually — no clustering.
 * - zoom < 9 (zoomed out): overlapping places group into a cluster that expands on click.
 * - a cell containing the selected place is never clustered, so the selected
 *   marker always stays individually visible and in sync with the place cards.
 */
function clusterPlaces(
  places: PlottablePlace[],
  zoom: number,
  selectedPlaceId?: string | null
): ClusteredItem[] {
  if (places.length === 0) return [];

  // Individual markers at close range; clustering only engages when zoomed out.
  if (zoom >= 9) {
    return places.map(place => ({ type: 'marker' as const, place }));
  }

  // Grid size based on zoom level - larger grid cells at lower zoom
  const gridSize = Math.max(0.01, 0.1 / Math.pow(2, zoom - 10));

  const grid = new Map<string, PlottablePlace[]>();

  for (const place of places) {
    const gridX = Math.floor(place.location.longitude / gridSize);
    const gridY = Math.floor(place.location.latitude / gridSize);
    const key = `${gridX},${gridY}`;
    
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key)!.push(place);
  }

  const result: ClusteredItem[] = [];

  for (const [, cellPlaces] of grid) {
    const containsSelection =
      selectedPlaceId != null && cellPlaces.some((place) => place.id === selectedPlaceId);

    if (cellPlaces.length === 1 || containsSelection) {
      // Never hide the selected marker inside a cluster: plot the cell's
      // members individually so marker/card selection stays synchronized.
      for (const place of cellPlaces) {
        result.push({ type: 'marker', place });
      }
    } else {
      // Calculate cluster center
      const centerLat = cellPlaces.reduce((sum, p) => sum + p.location.latitude, 0) / cellPlaces.length;
      const centerLng = cellPlaces.reduce((sum, p) => sum + p.location.longitude, 0) / cellPlaces.length;
      result.push({
        type: 'cluster',
        count: cellPlaces.length,
        places: cellPlaces,
        center: [centerLat, centerLng],
      });
    }
  }

  return result;
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
  const [currentZoom, setCurrentZoom] = useState(resolvedZoom);

  // Compute clustered markers based on current zoom and selection
  const clusteredItems = useMemo(
    () => clusterPlaces(plottablePlaces, currentZoom, selectedPlaceId),
    [plottablePlaces, currentZoom, selectedPlaceId]
  );

  // Set mapReady after the map ref is attached (useLayoutEffect avoids act warnings).
  useLayoutEffect(() => {
    if (mapRef.current) {
      setMapReady(true);
    }
  }, []);

  // Track zoom level for clustering
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setCurrentZoom(map.getZoom());
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });
    return () => {
      map.off('zoomend');
    };
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
      
      {clusteredItems.map((item, index) => {
        if (item.type === 'marker') {
          const place = item.place;
          const isSelected = place.id === selectedPlaceId;
          
          return (
            <Marker
              key={place.id}
              position={[place.location.latitude, place.location.longitude]}
              icon={buildMarkerIcon(place, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
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
          );
        } else {
          // Render cluster marker
          const [centerLat, centerLng] = item.center;
          return (
            <Marker
              key={`cluster-${index}`}
              position={item.center}
              icon={L.divIcon({
                className: 'marker-cluster',
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                html: `<div class="marker-cluster-inner" style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:9999px;background:#16a34a;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.4);color:white;font-weight:600;font-size:14px;">${item.count}</div>`,
              })}
              eventHandlers={{
                click: () => {
                  // Zoom in to reveal individual markers
                  if (mapRef.current) {
                    mapRef.current.setView(item.center, Math.min(mapRef.current.getZoom() + 2, 14));
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {item.count} places
              </Tooltip>
            </Marker>
          );
        }
      })}
    </MapContainer>
  );
}