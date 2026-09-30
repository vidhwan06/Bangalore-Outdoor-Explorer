// Unit tests for places repository
// These test the query building logic without requiring a database

import { buildFilterWhere } from '@/features/places/repositories';
import type { PlaceCategory, PlaceStatus } from '@prisma/client';

describe('Places Repository - Query Building', () => {
  describe('buildFilterWhere', () => {
    it('returns empty where clause when no filters provided', () => {
      const { where, params } = buildFilterWhere(undefined, undefined, undefined);
      expect(where).toBe(
        'WHERE "visibilityLevel" IN (\'PUBLIC_EXACT\', \'PUBLIC_APPROXIMATE\')'
      );
      expect(params).toEqual([]);
    });

    it('includes category filter', () => {
      const { where, params } = buildFilterWhere('TREK', undefined, undefined);
      expect(where).toContain('category = $1::place_category');
      expect(where).toContain('"visibilityLevel" IN (\'PUBLIC_EXACT\', \'PUBLIC_APPROXIMATE\')');
      expect(params).toEqual(['TREK']);
    });

    it('includes status filter', () => {
      const { where, params } = buildFilterWhere(undefined, 'OPEN', undefined);
      expect(where).toContain('status = $1::place_status');
      expect(params).toEqual(['OPEN']);
    });

    it('includes difficulty filter', () => {
      const { where, params } = buildFilterWhere(undefined, undefined, 3);
      expect(where).toContain('difficulty = $1');
      expect(params).toEqual([3]);
    });

    it('combines all filters with AND', () => {
      const { where, params } = buildFilterWhere('TREK', 'OPEN', 2);
      expect(where).toContain('category = $1::place_category');
      expect(where).toContain('status = $2::place_status');
      expect(where).toContain('difficulty = $3');
      expect(where).toContain('"visibilityLevel" IN (\'PUBLIC_EXACT\', \'PUBLIC_APPROXIMATE\')');
      expect(params).toEqual(['TREK', 'OPEN', 2]);
    });

    it('excludes PRIVATE visibility level', () => {
      const { where } = buildFilterWhere(undefined, undefined, undefined);
      expect(where).not.toContain('PRIVATE');
      expect(where).not.toContain('MODERATOR_ONLY');
      expect(where).not.toContain('VERIFIED_COMMUNITY_ONLY');
    });

    it('includes only PUBLIC_EXACT and PUBLIC_APPROXIMATE visibility levels', () => {
      const { where } = buildFilterWhere(undefined, undefined, undefined);
      expect(where).toContain('PUBLIC_EXACT');
      expect(where).toContain('PUBLIC_APPROXIMATE');
    });
  });
});