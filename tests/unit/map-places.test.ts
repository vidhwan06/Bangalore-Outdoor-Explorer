// Unit tests for the central place → map privacy boundary.
// Pure logic — no database, no DOM.

import { toApproximateCoordinate, toMapPlacePoint } from '@/features/places/map-places';

describe('toMapPlacePoint', () => {
  it('passes exact coordinates through unchanged for PUBLIC_EXACT', () => {
    const point = toMapPlacePoint({
      id: 'place-1',
      name: 'Test Peak',
      latitude: 13.012345,
      longitude: 77.598765,
      visibilityLevel: 'PUBLIC_EXACT',
    });

    expect(point.location).toEqual({
      kind: 'exact',
      latitude: 13.012345,
      longitude: 77.598765,
    });
  });

  it('never exposes exact coordinates for PUBLIC_APPROXIMATE', () => {
    const point = toMapPlacePoint({
      id: 'place-2',
      name: 'Riverside Test Point',
      latitude: 12.954321,
      longitude: 77.487654,
      visibilityLevel: 'PUBLIC_APPROXIMATE',
    });

    expect(point.location.kind).toBe('approximate');
    if (point.location.kind !== 'approximate') {
      throw new Error('expected an approximate location');
    }

    // Coarse grid, within ~0.005° (~550 m) of the true point
    expect(point.location.latitude).toBe(12.95);
    expect(point.location.longitude).toBe(77.49);
    expect(Math.abs(point.location.latitude - 12.954321)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(point.location.longitude - 77.487654)).toBeLessThanOrEqual(0.005);

    // ...but definitively NOT the exact coordinate
    expect(point.location.latitude).not.toBe(12.954321);
    expect(point.location.longitude).not.toBe(77.487654);
  });

  it('resolves to unavailable when coordinates are missing', () => {
    const point = toMapPlacePoint({
      id: 'place-3',
      name: 'Test Peak',
      latitude: null,
      longitude: null,
      visibilityLevel: 'PUBLIC_EXACT',
    });

    expect(point.location).toEqual({ kind: 'unavailable' });
  });

  it('resolves to unavailable for non-public visibility levels', () => {
    const nonPublicLevels = ['VERIFIED_COMMUNITY_ONLY', 'MODERATOR_ONLY', 'PRIVATE'] as const;

    for (const visibilityLevel of nonPublicLevels) {
      const point = toMapPlacePoint({
        id: 'place-4',
        name: 'Test Peak',
        latitude: 13.0,
        longitude: 77.5,
        visibilityLevel,
      });

      expect(point.location).toEqual({ kind: 'unavailable' });
    }
  });

  it('treats an unrecognised visibility level as non-public', () => {
    const point = toMapPlacePoint({
      id: 'place-5',
      name: 'Test Peak',
      latitude: 13.0,
      longitude: 77.5,
      visibilityLevel: 'SOME_FUTURE_LEVEL',
    });

    expect(point.location).toEqual({ kind: 'unavailable' });
  });
});

describe('toApproximateCoordinate', () => {
  it('snaps coordinates to the 0.01 degree grid', () => {
    expect(toApproximateCoordinate(13.041)).toBe(13.04);
    expect(toApproximateCoordinate(13.049)).toBe(13.05);
    expect(toApproximateCoordinate(77.487654)).toBe(77.49);
    expect(toApproximateCoordinate(-12.956)).toBe(-12.96);
  });
});
