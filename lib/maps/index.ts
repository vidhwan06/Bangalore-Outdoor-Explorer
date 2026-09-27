// Maps abstraction
// Allows switching between Mapbox, Google Maps, Leaflet, etc.

/// <reference types="geojson" />

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewport {
  center: MapCoordinates;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapMarker {
  id: string;
  coordinates: MapCoordinates;
  title: string;
  category: string;
  difficulty?: number;
  status?: string;
  trustLevel?: string;
  customIcon?: string;
  popupContent?: string;
}

export interface MapLayer {
  id: string;
  type: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'heatmap';
  source: string | GeoJSONSource;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown[];
  minZoom?: number;
  maxZoom?: number;
}

export interface GeoJSONSource {
  type: 'geojson';
  data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
  cluster?: boolean;
  clusterRadius?: number;
  clusterMaxZoom?: number;
}

export interface MapStyle {
  version: number;
  name: string;
  sources: Record<string, GeoJSONSource | VectorSource | RasterSource>;
  layers: MapLayer[];
  sprite?: string;
  glyphs?: string;
}

export interface VectorSource {
  type: 'vector';
  url: string;
  minZoom?: number;
  maxZoom?: number;
}

export interface RasterSource {
  type: 'raster';
  url: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface GeocodeResult {
  placeName: string;
  coordinates: MapCoordinates;
  bbox?: [number, number, number, number];
  context?: Array<{
    id: string;
    text: string;
    shortCode?: string;
  }>;
}

export interface DirectionsResult {
  routes: Array<{
    geometry: GeoJSON.LineString;
    distance: number; // meters
    duration: number; // seconds
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        geometry: GeoJSON.LineString;
        maneuver: {
          type: string;
          instruction: string;
        };
      }>;
    }>;
  }>;
  waypoints: Array<{
    coordinates: MapCoordinates;
    name: string;
  }>;
}

export interface MapProvider {
  name: string;

  // Initialization
  initialize(config: MapProviderConfig): Promise<void>;
  destroy(): void;

  // Map instance
  getMap(): unknown; // Return the underlying map instance

  // Viewport
  setViewport(viewport: MapViewport, animated?: boolean): Promise<void>;
  getViewport(): MapViewport;
  fitBounds(bounds: MapBounds, padding?: number, animated?: boolean): Promise<void>;

  // Markers
  addMarker(marker: MapMarker): Promise<void>;
  removeMarker(markerId: string): Promise<void>;
  updateMarker(markerId: string, updates: Partial<MapMarker>): Promise<void>;
  clearMarkers(): Promise<void>;

  // Layers
  addLayer(layer: MapLayer): Promise<void>;
  removeLayer(layerId: string): Promise<void>;
  updateLayer(layerId: string, updates: Partial<MapLayer>): Promise<void>;
  setLayerVisibility(layerId: string, visible: boolean): Promise<void>;

  // Sources
  addSource(sourceId: string, source: GeoJSONSource | VectorSource | RasterSource): Promise<void>;
  removeSource(sourceId: string): Promise<void>;
  updateSourceData(
    sourceId: string,
    data: GeoJSON.FeatureCollection | GeoJSON.Feature
  ): Promise<void>;

  // Geocoding
  geocode(query: string): Promise<GeocodeResult[]>;
  reverseGeocode(coordinates: MapCoordinates): Promise<GeocodeResult | null>;

  // Directions
  getDirections(
    origin: MapCoordinates,
    destination: MapCoordinates,
    profile?: 'driving' | 'walking' | 'cycling'
  ): Promise<DirectionsResult>;

  // Events
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;

  // Utilities
  project(coordinates: MapCoordinates): { x: number; y: number };
  unproject(point: { x: number; y: number }): MapCoordinates;
  getCanvasContainer(): HTMLElement | null;
}

export interface MapProviderConfig {
  accessToken: string;
  style?: string;
  container: HTMLElement;
  center?: MapCoordinates;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  pitch?: number;
  bearing?: number;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
}

// Map provider types
export type MapProviderType = 'mapbox' | 'google' | 'leaflet' | 'maplibre';

export interface MapProviderFactory {
  create(config: MapProviderConfig): Promise<MapProvider>;
  getName(): MapProviderType;
}

// Default configuration for Bengaluru area
export const BENGALURU_BOUNDS: MapBounds = {
  north: 13.5,
  south: 12.5,
  east: 78.5,
  west: 77.0,
};

export const BENGALURU_CENTER: MapCoordinates = {
  latitude: 12.9716,
  longitude: 77.5946,
};

export const DEFAULT_MAP_VIEWPORT: MapViewport = {
  center: BENGALURU_CENTER,
  zoom: 10,
};

export const MAP_CONFIG = {
  minZoom: 3,
  maxZoom: 20,
  defaultZoom: 10,
  clusterRadius: 50,
  clusterMaxZoom: 14,
};
