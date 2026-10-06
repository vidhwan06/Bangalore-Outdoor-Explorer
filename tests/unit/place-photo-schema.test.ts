// Unit tests for the PlacePhoto schema layer:
//   - provenance validation (licence vocabulary, attribution, alt text, source URL)
//   - primary-photo integrity rules exposed at the application boundary
//   - photo ordering as the repository will apply it

import {
  photoLicenseSchema,
  placePhotoCreateSchema,
  placePhotoProvenanceSchema,
  placePhotoSchema,
  placePhotoUpdateSchema,
  REDISTRIBUTABLE_PHOTO_LICENSES,
} from '@/lib/validation/schemas';

// Mirrors the DDL in prisma/migrations/03_place_photo_provenance/migration.sql.
// Kept here so a drift between code and database is caught by the test suite.
const DB_LICENSE_VALUES = [
  'CC0',
  'PUBLIC_DOMAIN',
  'CC_BY',
  'CC_BY_SA',
  'CC_BY_ND',
  'CC_BY_NC',
  'CC_BY_NC_SA',
  'CC_BY_NC_ND',
  'ALL_RIGHTS_RESERVED',
  'PERMISSION_ON_FILE',
];

const validProvenance = {
  license: 'CC_BY_SA' as const,
  attribution: 'Jane Doe / Wikimedia Commons',
  altText: 'Sunrise over the Nandi Hills summit fort',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nandi_Hills.jpg',
  photographerName: 'Jane Doe',
};

describe('PlacePhoto — licence vocabulary', () => {
  it('accepts every licence the database CHECK constraint allows', () => {
    for (const license of DB_LICENSE_VALUES) {
      expect(photoLicenseSchema.safeParse(license).success).toBe(true);
    }
  });

  it('does not allow any licence the database CHECK constraint rejects', () => {
    // Anything the schema accepts must be in the DB list, or the insert fails.
    const allowed = [
      ...photoLicenseSchema.options,
    ].sort();
    expect(allowed).toEqual([...DB_LICENSE_VALUES].sort());
  });

  it('rejects unknown licences', () => {
    expect(photoLicenseSchema.safeParse('MYSTERY_LICENSE').success).toBe(false);
    expect(photoLicenseSchema.safeParse('cc_by').success).toBe(false);
    expect(photoLicenseSchema.safeParse('PUBLIC DOMAIN').success).toBe(false);
  });

  it('marks only permissive licences as redistributable', () => {
    expect(REDISTRIBUTABLE_PHOTO_LICENSES).toContain('CC_BY_SA');
    expect(REDISTRIBUTABLE_PHOTO_LICENSES).toContain('CC0');
    expect(REDISTRIBUTABLE_PHOTO_LICENSES).not.toContain('ALL_RIGHTS_RESERVED');
    expect(REDISTRIBUTABLE_PHOTO_LICENSES).not.toContain('PERMISSION_ON_FILE');
  });
});

describe('PlacePhoto — provenance is mandatory', () => {
  it('accepts a complete provenance record', () => {
    expect(placePhotoProvenanceSchema.safeParse(validProvenance).success).toBe(true);
  });

  it('requires a licence', () => {
    const { license, ...withoutLicense } = validProvenance;
    expect(license).toBe('CC_BY_SA');
    const result = placePhotoProvenanceSchema.safeParse(withoutLicense);
    expect(result.success).toBe(false);
  });

  it('requires a non-blank attribution', () => {
    expect(placePhotoProvenanceSchema.safeParse({ ...validProvenance, attribution: '' }).success).toBe(false);
    expect(placePhotoProvenanceSchema.safeParse({ ...validProvenance, attribution: '   ' }).success).toBe(false);
  });

  it('requires non-blank alt text', () => {
    expect(placePhotoProvenanceSchema.safeParse({ ...validProvenance, altText: '' }).success).toBe(false);
    expect(placePhotoProvenanceSchema.safeParse({ ...validProvenance, altText: '\t ' }).success).toBe(false);
  });

  it('treats sourceUrl as optional but must be http(s) when present', () => {
    const { sourceUrl, ...withoutSource } = validProvenance;
    expect(sourceUrl).toBeTruthy();
    expect(placePhotoProvenanceSchema.safeParse(withoutSource).success).toBe(true);
    expect(
      placePhotoProvenanceSchema.safeParse({ ...validProvenance, sourceUrl: null }).success
    ).toBe(true);
    expect(
      placePhotoProvenanceSchema.safeParse({ ...validProvenance, sourceUrl: 'ftp://example.com/x.jpg' })
        .success
    ).toBe(false);
    expect(
      placePhotoProvenanceSchema.safeParse({ ...validProvenance, sourceUrl: 'not-a-url' }).success
    ).toBe(false);
  });

  it('allows a missing photographerName (public-domain images have no author)', () => {
    const { photographerName, ...withoutPhotographer } = validProvenance;
    expect(photographerName).toBeTruthy();
    expect(placePhotoProvenanceSchema.safeParse(withoutPhotographer).success).toBe(true);
  });
});

describe('PlacePhoto — create schema', () => {
  const base = {
    placeId: 'place-1',
    url: 'https://project.supabase.co/storage/v1/object/public/place-photos/places/p1/photos/a.jpg',
    ...validProvenance,
  };

  it('applies the primary-photo and ordering defaults', () => {
    const parsed = placePhotoCreateSchema.parse(base);
    expect(parsed.isPrimary).toBe(false);
    expect(parsed.sortOrder).toBe(0);
  });

  it('rejects a negative sortOrder', () => {
    expect(placePhotoCreateSchema.safeParse({ ...base, sortOrder: -1 }).success).toBe(false);
  });

  it('rejects a non-integer sortOrder', () => {
    expect(placePhotoCreateSchema.safeParse({ ...base, sortOrder: 1.5 }).success).toBe(false);
  });

  it('rejects a non-http photo url', () => {
    // z.string().url() alone would accept a data: URI, which is not a valid
    // storage location.
    expect(placePhotoCreateSchema.safeParse({ ...base, url: 'data:image/png;base64,AAAA' }).success).toBe(
      false
    );
    expect(placePhotoCreateSchema.safeParse({ ...base, thumbnailUrl: 'data:image/png;base64,AAAA' }).success).toBe(
      false
    );
    expect(placePhotoCreateSchema.safeParse({ ...base, url: 'https://example.com/a.jpg' }).success).toBe(
      true
    );
  });

  it('rejects provenance that would violate a database CHECK constraint', () => {
    expect(placePhotoCreateSchema.safeParse({ ...base, license: 'NOPE' }).success).toBe(false);
    expect(placePhotoCreateSchema.safeParse({ ...base, attribution: ' ' }).success).toBe(false);
    expect(placePhotoCreateSchema.safeParse({ ...base, altText: '' }).success).toBe(false);
  });
});

describe('PlacePhoto — update schema', () => {
  it('still enforces provenance on a partial update', () => {
    expect(placePhotoUpdateSchema.safeParse({ attribution: 'Jane Doe' }).success).toBe(true);
    expect(placePhotoUpdateSchema.safeParse({ attribution: '' }).success).toBe(false);
    expect(placePhotoUpdateSchema.safeParse({ license: 'NOPE' }).success).toBe(false);
    expect(placePhotoUpdateSchema.safeParse({ altText: '  ' }).success).toBe(false);
  });

  it('permits reordering and re-flagging the primary photo', () => {
    expect(placePhotoUpdateSchema.safeParse({ isPrimary: true }).success).toBe(true);
    expect(placePhotoUpdateSchema.safeParse({ sortOrder: 3 }).success).toBe(true);
    expect(placePhotoUpdateSchema.safeParse({ sortOrder: -3 }).success).toBe(false);
  });
});

describe('PlacePhoto — response contract', () => {
  it('always carries attribution so it can be rendered', () => {
    const record = {
      id: 'photo-1',
      placeId: 'place-1',
      url: 'https://example.com/a.jpg',
      thumbnailUrl: null,
      caption: null,
      license: 'CC0',
      attribution: 'Public domain',
      altText: 'A rocky ridge at dawn',
      sourceUrl: null,
      photographerName: null,
      isPrimary: true,
      sortOrder: 0,
    };
    expect(placePhotoSchema.safeParse(record).success).toBe(true);
    const { attribution, ...withoutAttribution } = record;
    expect(attribution).toBeTruthy();
    expect(placePhotoSchema.safeParse(withoutAttribution).success).toBe(false);
  });
});

describe('PlacePhoto — ordering used by the repository', () => {
  /**
   * The database guarantees at most one isPrimary per place
   * (idx_place_photo_one_primary) and indexes (placeId, isPrimary, sortOrder).
   * These assertions document the read order the repository must use so that
   * the partial index is actually usable.
   */
  const photos = [
    { url: 'c.jpg', isPrimary: false, sortOrder: 1 },
    { url: 'a.jpg', isPrimary: false, sortOrder: 0 },
    { url: 'primary.jpg', isPrimary: true, sortOrder: 0 },
  ];

  const sortForRead = <T extends { isPrimary: boolean; sortOrder: number }>(list: T[]): T[] =>
    [...list].sort((a, b) =>
      a.isPrimary === b.isPrimary ? a.sortOrder - b.sortOrder : a.isPrimary ? -1 : 1
    );

  it('returns the primary photo first, then by sortOrder', () => {
    const ordered = sortForRead(photos);
    expect(ordered.map((p) => p.url)).toEqual(['primary.jpg', 'a.jpg', 'c.jpg']);
  });

  it('yields the primary photo as the first element', () => {
    expect(sortForRead(photos)[0].isPrimary).toBe(true);
  });

  it('is stable and total when no photo is primary', () => {
    // Distinct sortOrder values so the result is unambiguous.
    const nonePrimary = [
      { url: 'c.jpg', isPrimary: false, sortOrder: 1 },
      { url: 'a.jpg', isPrimary: false, sortOrder: 0 },
      { url: 'primary.jpg', isPrimary: false, sortOrder: 2 },
    ];
    expect(sortForRead(nonePrimary).map((p) => p.url)).toEqual([
      'a.jpg',
      'c.jpg',
      'primary.jpg',
    ]);
  });

  it('falls back to sortOrder when the place has no primary photo', () => {
    // A place may legitimately have zero primary photos; ordering must still work.
    const nonePrimary = photos.map((p) => ({ ...p, isPrimary: false, sortOrder: p.sortOrder + 5 }));
    const ordered = sortForRead(nonePrimary);
    expect(ordered.map((p) => p.url)).toEqual(['a.jpg', 'primary.jpg', 'c.jpg']);
  });

  it('handles an empty gallery without throwing', () => {
    expect(sortForRead([])).toEqual([]);
  });
});
