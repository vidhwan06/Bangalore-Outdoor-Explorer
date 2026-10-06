// Unit tests for the storage layer helpers used by place photos:
//   - path generation following STORAGE_PATHS.PLACE_PHOTOS
//   - filename sanitisation / traversal defence
//   - MIME + size validation (preserved existing helpers)
//   - bucket configuration and provider resolution

import {
  FILE_CATEGORIES,
  MAX_FILE_SIZES,
  PLACE_PHOTO_MIME_TYPES,
  PLACE_PHOTOS_BUCKET,
  STORAGE_PATHS,
  buildPlacePhotoKey,
  formatBytes,
  generateStoragePath,
  generateUniqueKey,
  getFileCategory,
  getMaxFileSize,
  getStorageProvider,
  sanitizeStorageFilename,
  validateFile,
  validatePlacePhotoFile,
} from '@/lib/storage';

describe('storage — bucket configuration', () => {
  it('uses the bucket created by migration 03', () => {
    // prisma/migrations/03_place_photo_provenance/migration.sql inserts this name.
    expect(PLACE_PHOTOS_BUCKET).toBe('place-photos');
  });

  it('accepts only image mime types for place photos', () => {
    expect([...PLACE_PHOTO_MIME_TYPES].sort()).toEqual([...FILE_CATEGORIES.IMAGE].sort());
    expect(PLACE_PHOTO_MIME_TYPES.every((t) => getFileCategory(t) === 'IMAGE')).toBe(true);
  });
});

describe('storage — place photo path generation', () => {
  it('builds keys under places/{placeId}/photos', () => {
    expect(STORAGE_PATHS.PLACE_PHOTOS).toBe('places/{placeId}/photos');
    expect(buildPlacePhotoKey('abc-123', 'sunrise.jpg')).toBe(
      'places/abc-123/photos/sunrise.jpg'
    );
  });

  it('keeps the existing generateStoragePath behaviour', () => {
    expect(generateStoragePath(STORAGE_PATHS.PLACE_PHOTOS, { placeId: 'p1' })).toBe(
      'places/p1/photos'
    );
  });

  it('always produces exactly one photo folder level per place', () => {
    const key = buildPlacePhotoKey('place-1', 'a.jpg');
    expect(key.split('/')).toEqual(['places', 'place-1', 'photos', 'a.jpg']);
  });

  it('strips directory traversal from the filename', () => {
    expect(buildPlacePhotoKey('p1', '../../etc/passwd')).toBe('places/p1/photos/passwd');
    expect(buildPlacePhotoKey('p1', '../other-place/secret.jpg')).toBe(
      'places/p1/photos/secret.jpg'
    );
    expect(buildPlacePhotoKey('p1', 'a/b/c.jpg')).toBe('places/p1/photos/c.jpg');
  });

  it('strips Windows-style separators too', () => {
    expect(sanitizeStorageFilename('C:\\temp\\photo.jpg')).toBe('photo.jpg');
    expect(sanitizeStorageFilename('..\\..\\evil.png')).toBe('evil.png');
  });

  it('replaces unsafe characters but keeps a usable extension', () => {
    expect(sanitizeStorageFilename('my photo (1).jpg')).toBe('my-photo--1-.jpg');
    expect(sanitizeStorageFilename('a b.jpeg')).toBe('a-b.jpeg');
  });

  it('falls back to a safe name for degenerate input', () => {
    expect(sanitizeStorageFilename('')).toBe('photo');
    expect(sanitizeStorageFilename('...')).toBe('photo');
    expect(sanitizeStorageFilename('.hidden.jpg')).toBe('hidden.jpg');
  });

  it('caps filename length', () => {
    expect(sanitizeStorageFilename(`${'a'.repeat(400)}.jpg`).length).toBeLessThanOrEqual(120);
  });

  it('never lets a photo key escape its own place folder', () => {
    for (const name of ['../../x.jpg', '/etc/passwd', 'a/../../b.jpg', '']) {
      const key = buildPlacePhotoKey('p1', name);
      expect(key.startsWith('places/p1/photos/')).toBe(true);
      expect(key).not.toContain('..');
    }
  });

  it('preserves generateUniqueKey collision resistance', () => {
    const a = generateUniqueKey('places/p1/photos', 'x.jpg');
    const b = generateUniqueKey('places/p1/photos', 'x.jpg');
    expect(a).not.toBe(b);
    expect(a.startsWith('places/p1/photos/')).toBe(true);
    expect(a.endsWith('.jpg')).toBe(true);
  });
});

describe('storage — validation helpers (unchanged behaviour)', () => {
  it('classifies image mime types', () => {
    expect(getFileCategory('image/jpeg')).toBe('IMAGE');
    expect(getFileCategory('image/webp')).toBe('IMAGE');
    expect(getFileCategory('video/mp4')).toBe('VIDEO');
    expect(getFileCategory('application/x-not-real')).toBeNull();
  });

  it('caps images at 10MB', () => {
    expect(getMaxFileSize('IMAGE')).toBe(MAX_FILE_SIZES.IMAGE);
    expect(MAX_FILE_SIZES.IMAGE).toBe(10 * 1024 * 1024);
  });

  it('rejects an oversized image', () => {
    const result = validateFile('image/jpeg', MAX_FILE_SIZES.IMAGE + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File too large');
  });

  it('accepts an image exactly at the limit', () => {
    expect(validateFile('image/jpeg', MAX_FILE_SIZES.IMAGE).valid).toBe(true);
  });

  it('rejects an unsupported type in the generic validator', () => {
    expect(validateFile('application/x-msdownload', 10).valid).toBe(false);
  });

  it('formats sizes for error messages', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
  });
});

describe('storage — place photo validation', () => {
  it('accepts each configured photo mime type', () => {
    for (const mime of PLACE_PHOTO_MIME_TYPES) {
      expect(validatePlacePhotoFile(mime, 1024)).toEqual({ valid: true });
    }
  });

  it('rejects non-image types even though they are valid storage files', () => {
    const result = validatePlacePhotoFile('video/mp4', 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Not an image type');
    // ...while the generic validator still accepts it, proving we narrowed scope
    expect(validateFile('video/mp4', 1024).valid).toBe(true);
  });

  it('enforces the image size limit', () => {
    expect(validatePlacePhotoFile('image/png', MAX_FILE_SIZES.IMAGE + 1).valid).toBe(false);
    expect(validatePlacePhotoFile('image/png', MAX_FILE_SIZES.IMAGE).valid).toBe(true);
  });

  it('rejects an unknown mime type', () => {
    expect(validatePlacePhotoFile('image/svg+xml', 10).valid).toBe(false);
  });
});

describe('storage — provider resolution', () => {
  const originalProvider = process.env.STORAGE_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = originalProvider;
  });

  it('defaults to supabase', async () => {
    delete process.env.STORAGE_PROVIDER;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const provider = await getStorageProvider();
    expect(provider.name).toBe('supabase');
  });

  it('refuses to silently fall back for an unimplemented provider', async () => {
    process.env.STORAGE_PROVIDER = 'cloudinary';
    await expect(getStorageProvider()).rejects.toThrow(/not implemented/i);
  });

  it('surfaces a clear error when the provider is misconfigured', async () => {
    process.env.STORAGE_PROVIDER = 'supabase';
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    await expect(getStorageProvider()).rejects.toThrow(/projectUrl/);
  });
});
