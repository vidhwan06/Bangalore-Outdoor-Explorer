// Unit tests for PostGIS helper functions

import {
  validateCoordinates,
  createGeographyPoint,
  getLatitudeSQL,
  getLongitudeSQL,
  getDistanceSQL,
  getWithinRadiusSQL,
  getWithinBoundsSQL,
} from '@/lib/db/postgis';

describe('PostGIS Helper Functions', () => {
  describe('validateCoordinates', () => {
    it('accepts valid Bengaluru coordinates', () => {
      expect(() => validateCoordinates(12.9716, 77.5946)).not.toThrow();
    });

    it('accepts latitude at boundary -90', () => {
      expect(() => validateCoordinates(-90, 0)).not.toThrow();
    });

    it('accepts latitude at boundary 90', () => {
      expect(() => validateCoordinates(90, 0)).not.toThrow();
    });

    it('accepts longitude at boundary -180', () => {
      expect(() => validateCoordinates(0, -180)).not.toThrow();
    });

    it('accepts longitude at boundary 180', () => {
      expect(() => validateCoordinates(0, 180)).not.toThrow();
    });

    it('rejects latitude below -90', () => {
      expect(() => validateCoordinates(-91, 0)).toThrow('Invalid latitude: -91');
    });

    it('rejects latitude above 90', () => {
      expect(() => validateCoordinates(91, 0)).toThrow('Invalid latitude: 91');
    });

    it('rejects longitude below -180', () => {
      expect(() => validateCoordinates(0, -181)).toThrow('Invalid longitude: -181');
    });

    it('rejects longitude above 180', () => {
      expect(() => validateCoordinates(0, 181)).toThrow('Invalid longitude: 181');
    });
  });

  describe('createGeographyPoint', () => {
    it('creates correct PostGIS SQL with longitude first', () => {
      const sql = createGeographyPoint(77.5946, 12.9716);
      expect(sql).toBe('ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography');
    });

    it('validates coordinates before creating SQL', () => {
      expect(() => createGeographyPoint(181, 0)).toThrow('Invalid longitude: 181');
      expect(() => createGeographyPoint(0, 91)).toThrow('Invalid latitude: 91');
    });

    it('handles negative coordinates correctly', () => {
      const sql = createGeographyPoint(-122.4194, 37.7749); // San Francisco
      expect(sql).toBe('ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography');
    });
  });

  describe('getLatitudeSQL', () => {
    it('returns correct SQL for extracting latitude', () => {
      expect(getLatitudeSQL()).toBe('ST_Y(location::geometry)');
    });
  });

  describe('getLongitudeSQL', () => {
    it('returns correct SQL for extracting longitude', () => {
      expect(getLongitudeSQL()).toBe('ST_X(location::geometry)');
    });
  });

  describe('getDistanceSQL', () => {
    it('creates correct ST_Distance SQL with longitude first', () => {
      const sql = getDistanceSQL(77.5946, 12.9716);
      expect(sql).toBe(
        'ST_Distance(location, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography)'
      );
    });

    it('validates coordinates', () => {
      expect(() => getDistanceSQL(181, 0)).toThrow('Invalid longitude: 181');
    });
  });

  describe('getWithinRadiusSQL', () => {
    it('creates correct ST_DWithin SQL with longitude first', () => {
      const sql = getWithinRadiusSQL(77.5946, 12.9716, 10000);
      expect(sql).toBe(
        'ST_DWithin(location, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 10000)'
      );
    });

    it('validates coordinates', () => {
      expect(() => getWithinRadiusSQL(181, 0, 1000)).toThrow('Invalid longitude: 181');
    });

    it('rejects negative radius', () => {
      expect(() => getWithinRadiusSQL(0, 0, -1)).toThrow('Invalid radius: -1');
    });

    it('accepts zero radius', () => {
      expect(() => getWithinRadiusSQL(0, 0, 0)).not.toThrow();
    });
  });

  describe('getWithinBoundsSQL', () => {
    it('creates correct envelope SQL', () => {
      const sql = getWithinBoundsSQL(77.0, 12.0, 78.0, 13.0);
      expect(sql).toBe('location && ST_MakeEnvelope(77, 12, 78, 13, 4326)::geography');
    });

    it('validates coordinate bounds', () => {
      expect(() => getWithinBoundsSQL(77.0, 12.0, 78.0, 13.0)).not.toThrow();
    });

    it('rejects when north <= south', () => {
      expect(() => getWithinBoundsSQL(77.0, 13.0, 78.0, 12.0)).toThrow(
        'Invalid bounds: north (12) must be > south (13)'
      );
    });

    it('rejects when east <= west', () => {
      expect(() => getWithinBoundsSQL(78.0, 12.0, 77.0, 13.0)).toThrow(
        'Invalid bounds: east (77) must be > west (78)'
      );
    });

    it('validates all coordinates are in range', () => {
      expect(() => getWithinBoundsSQL(-181, 12.0, 78.0, 13.0)).toThrow('Invalid longitude: -181');
      expect(() => getWithinBoundsSQL(77.0, -91, 78.0, 13.0)).toThrow('Invalid latitude: -91');
    });
  });

  describe('Coordinate ordering (critical test)', () => {
    it('ensures longitude is FIRST parameter in ST_MakePoint', () => {
      // This is the critical test to ensure we never swap lat/lng
      const lng = 77.5946;
      const lat = 12.9716;

      const pointSQL = createGeographyPoint(lng, lat);
      const distanceSQL = getDistanceSQL(lng, lat);
      const withinSQL = getWithinRadiusSQL(lng, lat, 1000);

      // All should have longitude FIRST (77.5946), then latitude (12.9716)
      expect(pointSQL).toContain('ST_MakePoint(77.5946, 12.9716)');
      expect(distanceSQL).toContain('ST_MakePoint(77.5946, 12.9716)');
      expect(withinSQL).toContain('ST_MakePoint(77.5946, 12.9716)');

      // Verify it's NOT the reverse
      expect(pointSQL).not.toContain('ST_MakePoint(12.9716, 77.5946)');
      expect(distanceSQL).not.toContain('ST_MakePoint(12.9716, 77.5946)');
      expect(withinSQL).not.toContain('ST_MakePoint(12.9716, 77.5946)');
    });
  });
});