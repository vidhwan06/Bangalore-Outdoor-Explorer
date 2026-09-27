// Routing abstraction
// For calculating routes, distances, travel times

/// <reference types="geojson" />

export interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

export interface RouteWaypoint extends RouteCoordinates {
  name?: string;
  type?: 'origin' | 'destination' | 'waypoint';
}

export interface RouteOptions {
  profile: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  alternatives?: boolean;
  steps?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  overview?: 'full' | 'simplified' | 'false';
  annotations?: ('duration' | 'distance' | 'speed' | 'congestion')[];
  continueStraight?: boolean;
}

export interface RouteStep {
  distance: number; // meters
  duration: number; // seconds
  geometry: GeoJSON.LineString;
  maneuver: {
    type: string;
    instruction: string;
    bearingBefore?: number;
    bearingAfter?: number;
    location: RouteCoordinates;
    modifier?: string;
  };
  name?: string;
  mode: 'driving' | 'walking' | 'cycling';
  intersections?: Array<{
    location: RouteCoordinates;
    bearings: number[];
    entry: boolean[];
    in?: number;
    out?: number;
    lanes?: Array<{
      indications?: string[];
      valid: boolean;
    }>;
  }>;
}

export interface RouteLeg {
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
  summary: string;
  weight: number;
  durationTypical?: number; // seconds
  annotation?: {
    distance?: number[];
    duration?: number[];
    speed?: number[];
    congestion?: number[];
  };
}

export interface Route {
  geometry: GeoJSON.LineString;
  distance: number; // meters
  duration: number; // seconds
  weight: number;
  weightName: 'duration' | 'distance';
  legs: RouteLeg[];
}

export interface RouteResponse {
  routes: Route[];
  waypoints: Array<{
    name: string;
    location: RouteCoordinates;
    distance: number;
  }>;
  code: 'Ok' | 'NoRoute' | 'NoSegment' | 'TooManyCoordinates';
  uuid?: string;
}

export interface RoutingProvider {
  name: string;

  // Get route between coordinates
  getRoute(coordinates: RouteCoordinates[], options?: RouteOptions): Promise<RouteResponse>;

  // Get route with waypoints
  getRouteWithWaypoints(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    waypoints?: RouteCoordinates[],
    options?: RouteOptions
  ): Promise<RouteResponse>;

  // Get distance matrix (multiple origins/destinations)
  getDistanceMatrix?(
    sources: RouteCoordinates[],
    destinations: RouteCoordinates[],
    profile?: RouteOptions['profile']
  ): Promise<{
    distances: number[][]; // meters
    durations: number[][]; // seconds
    sources: Array<{ location: RouteCoordinates; name: string }>;
    destinations: Array<{ location: RouteCoordinates; name: string }>;
  }>;

  // Get isochrone (reachable area within time/distance)
  getIsochrone?(
    center: RouteCoordinates,
    profile: RouteOptions['profile'],
    ranges: number[], // seconds or meters
    options?: {
      intervals?: number;
      polygons?: boolean;
    }
  ): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>>;

  // Health check
  healthCheck(): Promise<boolean>;
}

export interface RoutingProviderConfig {
  apiKey: string;
  baseUrl?: string;
  profile?: RouteOptions['profile'];
  timeout?: number;
}

export type RoutingProviderType = 'osrm' | 'valhalla' | 'mapbox' | 'google' | 'graphhopper';

export interface RoutingProviderFactory {
  create(config: RoutingProviderConfig): Promise<RoutingProvider>;
  getName(): RoutingProviderType;
}

// Default profiles for outdoor activities
export const ROUTING_PROFILES = {
  DRIVING: 'driving' as const,
  WALKING: 'walking' as const,
  CYCLING: 'cycling' as const,
  DRIVING_TRAFFIC: 'driving-traffic' as const,
} as const;

export type RoutingProfile = (typeof ROUTING_PROFILES)[keyof typeof ROUTING_PROFILES];

// Bengaluru-specific routing constants
export const BENGALURU_ROUTING = {
  // Major highway exits for trek access
  HIGHWAY_EXITS: [
    { name: 'NICE Road', lat: 12.9352, lng: 77.4999 },
    { name: 'NH-44 (Hyderabad)', lat: 13.2, lng: 77.7 },
    { name: 'NH-75 (Mangalore)', lat: 12.8, lng: 77.3 },
    { name: 'NH-48 (Chennai)', lat: 12.9, lng: 77.8 },
  ],

  // Popular base towns for treks
  BASE_TOWNS: [
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Devanahalli', lat: 13.2479, lng: 77.7063 },
    { name: 'Doddaballapur', lat: 13.2889, lng: 77.5431 },
    { name: 'Nelamangala', lat: 13.0983, lng: 77.3833 },
    { name: 'Ramanagara', lat: 12.7214, lng: 77.2812 },
    { name: 'Channapatna', lat: 12.6542, lng: 77.2017 },
    { name: 'Kanakapura', lat: 12.55, lng: 77.4167 },
    { name: 'Hosur', lat: 12.7409, lng: 77.8253 },
  ],

  // Default travel time buffers (minutes)
  TIME_BUFFERS: {
    driving: 15,
    walking: 10,
    cycling: 10,
  },

  // Speed assumptions for time estimation (km/h)
  AVERAGE_SPEEDS: {
    driving: 40, // Mixed city/highway
    'driving-traffic': 35, // Mixed with traffic
    walking: 5,
    cycling: 15,
  },
} as const;

// Utility functions
export function estimateTravelTime(
  distanceKm: number,
  profile: RoutingProfile,
  bufferMinutes = 0
): number {
  const speeds = BENGALURU_ROUTING.AVERAGE_SPEEDS;
  const speed = speeds[profile] || speeds.driving;
  const hours = distanceKm / speed;
  const minutes = hours * 60;
  return Math.ceil(minutes + bufferMinutes);
}

export function estimateTravelDistance(durationMinutes: number, profile: RoutingProfile): number {
  const speeds = BENGALURU_ROUTING.AVERAGE_SPEEDS;
  const speed = speeds[profile] || speeds.driving;
  const hours = durationMinutes / 60;
  return hours * speed;
}

export function formatRouteDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatRouteDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
