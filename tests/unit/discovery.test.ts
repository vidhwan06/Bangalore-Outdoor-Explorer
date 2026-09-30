// Unit tests for discovery options and location input validation

import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  MAX_RADIUS_METERS,
  PLACE_CATEGORY_LABELS,
  RADIUS_OPTIONS,
  formatRadius,
  validateDiscoveryLocation,
} from '@/features/places/discovery';

describe('formatRadius', () => {
  it('formats metres as whole kilometres', () => {
    expect(formatRadius(5000)).toBe('5 km');
    expect(formatRadius(10000)).toBe('10 km');
    expect(formatRadius(50000)).toBe('50 km');
  });
});

describe('discovery filter options', () => {
  it('offers radius options within the API maximum', () => {
    for (const option of RADIUS_OPTIONS) {
      expect(Number(option.value)).toBeLessThanOrEqual(MAX_RADIUS_METERS);
    }
  });

  it('offers every place category with a clearable first entry', () => {
    expect(CATEGORY_OPTIONS[0]).toEqual({ value: '', label: 'All categories' });
    const values = CATEGORY_OPTIONS.map((option) => option.value);
    expect(values).toHaveLength(Object.keys(PLACE_CATEGORY_LABELS).length + 1);
  });

  it('offers a clearable difficulty entry plus levels 1 to 5', () => {
    expect(DIFFICULTY_OPTIONS[0]).toEqual({ value: '', label: 'Any difficulty' });
    expect(DIFFICULTY_OPTIONS.map((option) => option.value)).toEqual(['', '1', '2', '3', '4', '5']);
  });
});

describe('validateDiscoveryLocation', () => {
  it('accepts valid coordinates', () => {
    const result = validateDiscoveryLocation({ latitude: '12.9716', longitude: '77.5946' });
    expect(result).toEqual({ valid: true, latitude: 12.9716, longitude: 77.5946 });
  });

  it('rejects an empty latitude', () => {
    const result = validateDiscoveryLocation({ latitude: '', longitude: '77.5946' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.latitude).toBe('Latitude is required');
      expect(result.fieldErrors.longitude).toBeUndefined();
    }
  });

  it('rejects an empty longitude', () => {
    const result = validateDiscoveryLocation({ latitude: '12.9', longitude: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.longitude).toBe('Longitude is required');
    }
  });

  it('rejects non-numeric coordinates', () => {
    const result = validateDiscoveryLocation({ latitude: 'abc', longitude: '77.5' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.latitude).toBe('Latitude must be a number');
    }
  });

  it('rejects out-of-range coordinates', () => {
    const result = validateDiscoveryLocation({ latitude: '999', longitude: '200' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.latitude).toBe('Latitude must be between -90 and 90');
      expect(result.fieldErrors.longitude).toBe('Longitude must be between -180 and 180');
    }
  });

  it('accepts boundary coordinates', () => {
    expect(validateDiscoveryLocation({ latitude: '-90', longitude: '180' })).toEqual({
      valid: true,
      latitude: -90,
      longitude: 180,
    });
  });
});
