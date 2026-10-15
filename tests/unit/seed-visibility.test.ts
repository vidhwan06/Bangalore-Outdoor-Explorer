/**
 * Regression test for demo-place visibility configuration in prisma/seed.ts.
 *
 * The eight demo places must be MODERATOR_ONLY so they never leak into
 * public discovery (homepage, explore, place-detail pages, or the public
 * API). If this test fails, the seed script has been modified to make
 * demo places publicly visible.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Seed demo-place visibility', () => {
  const seedPath = resolve(__dirname, '../../prisma/seed.ts');
  const seedSource = readFileSync(seedPath, 'utf-8');

  it('sets visibilityLevel to MODERATOR_ONLY for all demo places', () => {
    const moderatorCount = (
      seedSource.match(/visibilityLevel:\s*visibility_level\.MODERATOR_ONLY/g) ?? []
    ).length;
    expect(moderatorCount).toBe(8);
  });

  it('does not set visibilityLevel to PUBLIC_EXACT for demo places', () => {
    const publicCount = (
      seedSource.match(/visibilityLevel:\s*visibility_level\.PUBLIC_EXACT/g) ?? []
    ).length;
    expect(publicCount).toBe(0);
  });
});
