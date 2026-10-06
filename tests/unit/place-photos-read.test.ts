// Unit tests for the PlacePhoto READ path (features/places/photos.ts).
//
// No database and no photo rows are involved: Prisma is mocked. These tests
// pin down the deterministic ordering contract, the empty state, the
// provenance/validation contract, and the absence of N+1 queries.

import {
  PHOTO_ORDER_BY,
  PHOTO_ORDER_BY_SQL,
  PRIMARY_PHOTO_SELECT_ITEM,
  findPhotosForPlace,
  findPrimaryPhotoUrl,
  findPrimaryPhotoUrls,
  primaryPhotoLateralSQL,
} from '@/features/places/photos';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    placePhoto: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return { prisma: mockPrisma, default: mockPrisma };
});

const mockFindMany = prisma.placePhoto.findMany as jest.MockedFunction<
  typeof prisma.placePhoto.findMany
>;
const mockFindFirst = prisma.placePhoto.findFirst as jest.MockedFunction<
  typeof prisma.placePhoto.findFirst
>;

function photo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'photo-1',
    placeId: 'place-1',
    url: 'https://example.supabase.co/storage/v1/object/public/place-photos/places/place-1/photos/a.jpg',
    thumbnailUrl: null,
    caption: null,
    license: 'CC_BY_SA',
    attribution: 'Jane Doe / Wikimedia Commons',
    altText: 'Sunrise over the summit',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    photographerName: 'Jane Doe',
    isPrimary: false,
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('photo ordering contract', () => {
  it('is primary DESC, then sortOrder ASC, then createdAt ASC', () => {
    expect(PHOTO_ORDER_BY).toEqual([
      { isPrimary: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ]);
  });

  it('expresses the same ordering in SQL', () => {
    expect(PHOTO_ORDER_BY_SQL).toBe('"isPrimary" DESC, "sortOrder" ASC, "createdAt" ASC');
  });

  it('keeps the typed and SQL orderings from drifting apart', () => {
    const typedFields = PHOTO_ORDER_BY.map((o) => Object.keys(o)[0]);
    const sqlFields = PHOTO_ORDER_BY_SQL.split(',').map((part) => part.trim().split(' ')[0].replace(/"/g, ''));
    expect(sqlFields).toEqual(typedFields);
  });

  it('applies the deterministic ordering to every photo read', async () => {
    mockFindMany.mockResolvedValue([]);
    await findPhotosForPlace('place-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [...PHOTO_ORDER_BY] })
    );
  });

  it('applies the same ordering to the single-photo lookup', async () => {
    mockFindFirst.mockResolvedValue(null);
    await findPrimaryPhotoUrl('place-1');
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [...PHOTO_ORDER_BY] })
    );
  });
});

describe('findPhotosForPlace', () => {
  it('returns an empty array for a place with zero photos', async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(findPhotosForPlace('place-1')).resolves.toEqual([]);
  });

  it('returns a single photo', async () => {
    mockFindMany.mockResolvedValue([photo()] as never);
    const result = await findPhotosForPlace('place-1');
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('/a.jpg');
  });

  it('returns every photo, preserving the order the query produced', async () => {
    const rows = [
      photo({ id: 'p1', url: 'https://e.com/primary.jpg', isPrimary: true, sortOrder: 0 }),
      photo({ id: 'p2', url: 'https://e.com/second.jpg', isPrimary: false, sortOrder: 0 }),
      photo({ id: 'p3', url: 'https://e.com/third.jpg', isPrimary: false, sortOrder: 1 }),
    ];
    mockFindMany.mockResolvedValue(rows as never);
    const result = await findPhotosForPlace('place-1');
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('carries provenance and accessibility fields to the caller', async () => {
    mockFindMany.mockResolvedValue([photo()] as never);
    const [result] = await findPhotosForPlace('place-1');
    expect(result).toMatchObject({
      license: 'CC_BY_SA',
      attribution: 'Jane Doe / Wikimedia Commons',
      altText: 'Sunrise over the summit',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      photographerName: 'Jane Doe',
      isPrimary: false,
      sortOrder: 0,
    });
  });

  it('does not leak internal columns', async () => {
    mockFindMany.mockResolvedValue([photo()] as never);
    const [result] = await findPhotosForPlace('place-1');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('photographerId');
  });

  it('only selects the public photo columns', async () => {
    mockFindMany.mockResolvedValue([]);
    await findPhotosForPlace('place-1');
    const select = mockFindMany.mock.calls[0][0]?.select as Record<string, boolean>;
    expect(Object.keys(select).sort()).toEqual(
      [
        'altText',
        'attribution',
        'caption',
        'id',
        'isPrimary',
        'license',
        'photographerName',
        'placeId',
        'sortOrder',
        'sourceUrl',
        'thumbnailUrl',
        'url',
      ].sort()
    );
  });

  it('fails loudly when a row violates its own schema', async () => {
    mockFindMany.mockResolvedValue([photo({ license: 'NOT_A_LICENCE' })] as never);
    await expect(findPhotosForPlace('place-1')).rejects.toThrow(/failed validation/i);
  });

  it('fails loudly on blank attribution rather than dropping the row', async () => {
    mockFindMany.mockResolvedValue([photo({ attribution: '   ' })] as never);
    await expect(findPhotosForPlace('place-1')).rejects.toThrow(/failed validation/i);
  });

  it('issues exactly one query for any number of photos', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => photo({ id: `p${i}` })) as never
    );
    await findPhotosForPlace('place-1');
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('findPrimaryPhotoUrl', () => {
  it('returns null for a place with zero photos', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(findPrimaryPhotoUrl('place-1')).resolves.toBeNull();
  });

  it('returns the url of the row the ordering selected', async () => {
    mockFindFirst.mockResolvedValue({ url: 'https://e.com/primary.jpg' } as never);
    await expect(findPrimaryPhotoUrl('place-1')).resolves.toBe('https://e.com/primary.jpg');
  });
});

describe('findPrimaryPhotoUrls (batch — never a per-place loop)', () => {
  it('returns an empty map for an empty input without querying', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await findPrimaryPhotoUrls([]);
    expect(result.size).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('picks the first row per place, honouring the query ordering', async () => {
    // Rows arrive already ordered by isPrimary DESC, sortOrder ASC, createdAt ASC.
    mockFindMany.mockResolvedValue([
      { placeId: 'a', url: 'https://e.com/a-primary.jpg' },
      { placeId: 'a', url: 'https://e.com/a-second.jpg' },
      { placeId: 'b', url: 'https://e.com/b-primary.jpg' },
    ] as never);
    const result = await findPrimaryPhotoUrls(['a', 'b']);
    expect(result.get('a')).toBe('https://e.com/a-primary.jpg');
    expect(result.get('b')).toBe('https://e.com/b-primary.jpg');
    expect(result.size).toBe(2);
  });

  it('de-duplicates ids before querying', async () => {
    mockFindMany.mockResolvedValue([]);
    await findPrimaryPhotoUrls(['a', 'a', 'b']);
    expect(mockFindMany.mock.calls[0][0]?.where).toEqual({ placeId: { in: ['a', 'b'] } });
  });

  it('issues exactly one query regardless of how many places are requested', async () => {
    mockFindMany.mockResolvedValue([] as never);
    await findPrimaryPhotoUrls(Array.from({ length: 100 }, (_, i) => `place-${i}`));
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('omits places that have no photos', async () => {
    mockFindMany.mockResolvedValue([{ placeId: 'a', url: 'https://e.com/a.jpg' }] as never);
    const result = await findPrimaryPhotoUrls(['a', 'b']);
    expect(result.has('b')).toBe(false);
  });
});

describe('primaryPhotoLateralSQL', () => {
  const sql = primaryPhotoLateralSQL('p');

  it('is a LEFT JOIN LATERAL so places without photos are preserved', () => {
    expect(sql).toContain('LEFT JOIN LATERAL');
    expect(sql).toContain('ON TRUE');
  });

  it('uses the same deterministic ordering as the typed query', () => {
    expect(sql).toContain(PHOTO_ORDER_BY_SQL);
  });

  it('limits to a single photo', () => {
    expect(sql).toContain('LIMIT 1');
  });

  it('does not use PRIMARY as an alias (reserved SQL word)', () => {
    expect(sql).not.toMatch(/\)\s+primary\s+ON/);
  });

  it('honours the place alias it is given', () => {
    expect(primaryPhotoLateralSQL('place_row')).toContain('photo."placeId" = place_row.id');
  });

  it('selects only the url, not whole photo rows', () => {
    expect(sql).toMatch(/SELECT\s+url\s+FROM\s+"PlacePhoto"/);
  });

  it('pairs with the exported SELECT item', () => {
    expect(PRIMARY_PHOTO_SELECT_ITEM).toBe('pp.url AS "primaryPhotoUrl"');
    expect(sql).toContain(') pp ON TRUE');
  });
});
